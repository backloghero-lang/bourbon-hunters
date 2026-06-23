#!/usr/bin/perl
# Bourbon Hunters - database builder
# Reads woodencork.com products.json pages (/tmp/wc_page_*.json), keeps only
# bourbons from the priority brand list, dedupes, maps to the app schema, merges
# curated ratings from the existing db, and writes db/bourbons.json.
#
# Usage: perl scripts/build_db.pl <pages_glob> <curated_json> <out_json> <img_manifest>
use strict;
use warnings;
use JSON::PP;

my ($pages_glob, $curated_path, $out_path, $manifest_path) = @ARGV;
$pages_glob   ||= '/tmp/wc_page_*.json';
$curated_path ||= 'db/bourbons.json';
$out_path     ||= 'db/bourbons.json';
$manifest_path||= '/tmp/img_manifest.tsv';

# ---- priority brands (vendor or title match, case-insensitive substring) ----
my @PRIO = (
  'buffalo trace','eagle rare','w. l. weller','weller','george t. stagg','stagg',
  'blanton','colonel e.h. taylor','e.h. taylor','e. h. taylor','pappy van winkle',
  'wild turkey','russell','four roses','elijah craig','knob creek','maker\'s mark',
  'michter','bardstown bourbon','old forester','heaven hill','woodford','jefferson',
  'rare character','new riff',
);

# distillery normalization: map many vendor spellings to a canonical distillery
my %DISTILLERY = (
  'buffalo trace'                => 'Buffalo Trace Distillery',
  'eagle rare'                   => 'Buffalo Trace Distillery',
  'blanton'                      => 'Buffalo Trace Distillery',
  'w. l. weller'                 => 'Buffalo Trace Distillery',
  'weller'                       => 'Buffalo Trace Distillery',
  'george t. stagg'              => 'Buffalo Trace Distillery',
  'stagg'                        => 'Buffalo Trace Distillery',
  'colonel e.h. taylor'          => 'Buffalo Trace Distillery',
  'e.h. taylor'                  => 'Buffalo Trace Distillery',
  'pappy van winkle'             => 'Old Rip Van Winkle / Buffalo Trace',
  'wild turkey'                  => 'Wild Turkey Distillery',
  'russell'                      => 'Wild Turkey Distillery',
  'four roses'                   => 'Four Roses Distillery',
  'elijah craig'                 => 'Heaven Hill Distillery',
  'heaven hill'                  => 'Heaven Hill Distillery',
  'knob creek'                   => 'Jim Beam Distillery',
  'maker'                        => "Maker's Mark Distillery",
  'michter'                      => "Michter's Distillery",
  'bardstown bourbon'            => 'Bardstown Bourbon Company',
  'old forester'                 => 'Old Forester Distillery',
  'woodford'                     => 'Woodford Reserve Distillery',
  'jefferson'                    => "Jefferson's (Castle Brands)",
  'rare character'               => 'Rare Character Whiskey Co.',
  'new riff'                     => 'New Riff Distillery',
);

sub strip_html {
  my $s = shift // '';
  $s =~ s/<br\s*\/?>/ /gi;
  $s =~ s/<\/p>/ /gi;
  $s =~ s/<[^>]+>/ /g;
  $s =~ s/&amp;/&/g; $s =~ s/&nbsp;/ /g; $s =~ s/&#39;/'/g;
  $s =~ s/&quot;/"/g; $s =~ s/&lt;/</g; $s =~ s/&gt;/>/g;
  $s =~ s/\s+/ /g; $s =~ s/^\s+//; $s =~ s/\s+$//;
  return $s;
}

# normalized key for dedup / curated merge
sub norm_name {
  my $s = lc(shift // '');
  $s =~ s/\b(\d+(?:\.\d+)?\s*(?:ml|l)|750ml|1\.75l)\b//g;
  $s =~ s/\bkentucky\b//g; $s =~ s/\bstraight\b//g; $s =~ s/\bbourbon\b//g;
  $s =~ s/\bwhiskey\b//g; $s =~ s/\bwhisky\b//g;
  $s =~ s/[^a-z0-9]+/ /g; $s =~ s/\s+/ /g; $s =~ s/^\s+//; $s =~ s/\s+$//;
  return $s;
}

sub clean_name {
  my $s = shift // '';
  $s =~ s/\s*\d+(?:\.\d+)?\s*(?:ml|mL|ML|L)\b//g; # drop size suffix
  $s =~ s/\s{2,}/ /g; $s =~ s/^\s+//; $s =~ s/\s+$//;
  return $s;
}

# ---- read curated db for rating merge ----
my %curated;
my @curated_all;
my @curated_keys;   # longest first, for prefix matching
if (-e $curated_path) {
  open my $fh, '<', $curated_path or die "curated: $!";
  local $/; my $j = <$fh>; close $fh;
  my $d = eval { decode_json($j) };
  if ($d && $d->{bottles}) {
    @curated_all = @{$d->{bottles}};
    for my $b (@curated_all) {
      my $k = norm_name($b->{name});
      next unless length $k;
      $curated{$k} = $b unless exists $curated{$k};
    }
    @curated_keys = sort { length($b) <=> length($a) } keys %curated;
  }
}

# match a scraped normalized key to a curated entry: exact, else longest
# curated key that is a whole-word prefix of the scraped key.
sub match_curated {
  my $nk = shift;
  return $curated{$nk} if $curated{$nk};
  for my $ck (@curated_keys) {
    return $curated{$ck} if $nk eq $ck || index($nk, "$ck ") == 0;
  }
  return undef;
}

# ---- scan product pages ----
my (%seen_handle, %seen_norm, @bottles, @manifest);
my ($scanned, $kept, $skip_mini, $skip_set, $dupe) = (0,0,0,0,0);
my %idused;

for my $f (sort glob $pages_glob) {
  open my $fh, '<', $f or next; local $/; my $j = <$fh>; close $fh;
  my $d = eval { decode_json($j) }; next unless $d;
  for my $p (@{ $d->{products} }) {
    $scanned++;
    my $pt = $p->{product_type} // '';
    my $title = $p->{title} // '';
    my $isb = ($pt eq 'Bourbon' || $pt eq 'Bourbon Whiskey'
               || ($pt =~ /whiskey/i && $title =~ /bourbon/i));
    next unless $isb;

    my $vlc = lc($p->{vendor} // '');
    my $tlc = lc($title);
    my $brand;
    for my $b (@PRIO) {
      if (index($vlc, $b) >= 0 || index($tlc, $b) >= 0) { $brand = $b; last; }
    }
    next unless defined $brand;                          # priority brands only

    next if $seen_handle{ $p->{handle} }++;
    if ($title =~ /\b(50ml|100ml|200ml|375ml|mini)\b/i) { $skip_mini++; next; }
    if ($title =~ /\b(gift\s*set|gift|bundle|combo|\bset\b|glass|glasses|tasting kit|merch|t-shirt|hat)\b/i) { $skip_set++; next; }

    my $nk = norm_name($title);
    next unless length $nk;
    if ($seen_norm{$nk}++) { $dupe++; next; }            # dedupe near-identical

    # ---- core fields ----
    my $name = clean_name($title);
    my $distillery = $DISTILLERY{$brand} // ($p->{vendor} // 'Unknown');
    my $var = $p->{variants}[0] // {};
    my $price = $var->{price};
    $price = (defined $price && $price ne '') ? sprintf('%.2f', $price + 0) : undef;
    my $available = $var->{available} ? 1 : 0;

    my $img = $p->{images}[0]{src};
    # request a sized webp/jpg from the Shopify CDN to keep files small
    my $img_dl = '';
    if ($img) { ($img_dl = $img) =~ s/(\?|$)/?width=600&/ if 0; $img_dl = $img; }

    my $body = strip_html($p->{body_html});
    my $desc = $body;
    $desc = substr($desc, 0, 600) if length $desc > 600;
    $desc =~ s/\s+\S*$// if length $body > 600;          # don't cut mid-word
    $desc .= '…' if length $body > 600;

    # type / category detection
    my $type = 'Kentucky Straight Bourbon';
    my $category = 'Standard';
    my $wheated = ($tlc =~ /\bwheat/ || $body =~ /\bwheated\b/i
                   || $brand =~ /weller|pappy|maker/) ? 1 : 0;
    $type = 'Wheated Bourbon' if $wheated;
    $category = 'Single Barrel'   if $tlc =~ /single\s*barrel/;
    $category = 'Small Batch'     if $tlc =~ /small\s*batch/;
    $category = 'Barrel Proof'    if $tlc =~ /barrel\s*proof|cask\s*strength|full\s*proof/;
    $category = 'Bottled in Bond' if $tlc =~ /bonded|bottled[\s-]*in[\s-]*bond|\bbib\b/;
    $category = 'Limited Edition' if $tlc =~ /limited|release|\b20\d\d\b/;

    # proof / abv extraction (best effort)
    my ($proof) = ($title =~ /(\d{2,3}(?:\.\d)?)\s*proof/i);
    ($proof) = ($body =~ /(\d{2,3}(?:\.\d)?)\s*proof/i) unless defined $proof;
    my ($abv) = ($body =~ /(\d{2}(?:\.\d)?)\s*%/);
    $abv = sprintf('%.1f', $proof/2) if !defined($abv) && defined $proof;

    # region (best effort)
    my $region = 'Kentucky';
    $region = 'USA' if $distillery =~ /Bardstown Bourbon Company|Rare Character/;

    # unique id from handle
    (my $id = lc($p->{handle} // $nk)) =~ s/[^a-z0-9]+/-/g;
    $id =~ s/^-+//; $id =~ s/-+$//;
    $id ||= 'b' . $p->{id};
    my $base = $id; my $n = 2;
    while ($idused{$id}++) { $id = "$base-$n"; $n++; }

    my %bottle = (
      id         => $id,
      name       => $name,
      distillery => $distillery,
      region     => $region,
      type       => $type,
      category   => $category,
      proof      => (defined $proof ? $proof + 0 : undef),
      abv        => (defined $abv ? $abv + 0 : undef),
      mashbill   => undef,
      price      => (defined $price ? $price + 0 : undef),
      price_str  => (defined $price ? "\$$price" : undef),
      price_pln  => undef,
      quality    => undef,
      value      => undef,
      notes      => undef,
      desc       => $desc,
      image      => ($img ? "assets/bourbons/$id.webp" : ''),
      status     => $available ? 'available' : 'sold_out',
      source     => 'woodencork',
      url        => ($p->{handle} ? "https://woodencork.com/products/$p->{handle}" : undef),
    );

    # ---- merge curated ratings/notes if we have them ----
    if (my $c = match_curated($nk)) {
      $bottle{quality}  = $c->{quality}  if defined $c->{quality};
      $bottle{value}    = $c->{value}    if defined $c->{value};
      $bottle{notes}    = $c->{notes}    if defined $c->{notes} && $c->{notes} ne '';
      $bottle{mashbill} = $c->{mashbill} if defined $c->{mashbill} && $c->{mashbill} ne '';
      $bottle{price_pln}= $c->{price_pln} if defined $c->{price_pln} && $c->{price_pln} ne '';
      $bottle{proof}    = $c->{proof}    if !defined($bottle{proof}) && $c->{proof};
      $bottle{abv}      = $c->{abv}      if !defined($bottle{abv}) && $c->{abv};
      $bottle{source}   = 'woodencork+curated';
      $c->{_merged} = 1;
    }

    push @bottles, \%bottle;
    push @manifest, "$id\t$img_dl" if $img;
    $kept++;
  }
}

# sort: priority/popularity by distillery then name (stable, readable)
@bottles = sort { ($a->{distillery} cmp $b->{distillery}) || ($a->{name} cmp $b->{name}) } @bottles;

# ---- write outputs ----
my @today = localtime; my $date = sprintf('%04d-%02d-%02d', $today[5]+1900, $today[4]+1, $today[3]);
my $out = {
  version  => 2,
  updated  => $date,
  source   => 'woodencork.com/products.json (filtered to priority bourbon brands)',
  count    => scalar(@bottles),
  bottles  => \@bottles,
};
my $json = JSON::PP->new->utf8->canonical->pretty->space_before(0)->indent_length(2);
open my $o, '>', $out_path or die "out: $!";
print $o $json->encode($out);
close $o;

open my $m, '>', $manifest_path or die "manifest: $!";
print $m "$_\n" for @manifest;
close $m;

my $merged = grep { $_->{_merged} } values %curated;
print "scanned=$scanned kept=$kept dupe_skipped=$dupe minis=$skip_mini sets=$skip_set\n";
print "curated_merged=$merged of " . scalar(@curated_all) . "\n";
print "images_to_download=" . scalar(@manifest) . "\n";
print "wrote $out_path (count=" . scalar(@bottles) . ")\n";
