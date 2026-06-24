#!/usr/bin/perl
# Scraper sklepu Dom Whisky (IdoSell) - kategoria Bourbon.
# Czyta /tmp/dw_1..N.html, wyciaga produkty (id, nazwa, cena PLN, zdjecie, url),
# filtruje (<=2000 zl, bez zestawow/miniatur), odrzuca te ktore juz mamy,
# i zapisuje nowe do /tmp/dw_new.json + manifest zdjec /tmp/dw_img.tsv.
use strict; use warnings; use JSON::PP;

my $pages_glob = $ARGV[0] || '/tmp/dw_*.html';
my $db_path    = $ARGV[1] || 'db/bourbons.json';
my $out_json   = $ARGV[2] || '/tmp/dw_new.json';
my $out_img    = $ARGV[3] || '/tmp/dw_img.tsv';

# --- normalizacja do porownan miedzy sklepami ---
sub norm {
  my $s = lc(shift // '');
  $s =~ s/\byear[\s-]?old\b/year/g; $s =~ s/\b(\d+)[\s-]?yo\b/$1 year/g;
  $s =~ s/\b\d+(?:[.,]\d+)?\s*(?:ml|cl|l)\b//g;     # objetosc
  $s =~ s/\b\d+(?:[.,]\d+)?\s*%//g;                  # abv
  $s =~ s/\b(?:kentucky|straight|bourbon|whiskey|whisky|old|the)\b//g;
  $s =~ s/[^a-z0-9]+/ /g; $s =~ s/\s+/ /g; $s =~ s/^\s+//; $s =~ s/\s+$//;
  return $s;
}

# czysta nazwa do wyswietlenia: utnij po " / " (separator domwhisky) + ogon objetosci
sub disp_name {
  my $n = shift;
  $n =~ s{\s*/\s*\d.*$}{};            # "Name / 45% / 0.7l" -> "Name"
  $n =~ s/\s*\b\d+(?:[.,]\d+)?\s*%.*$//;
  $n =~ s/\s{2,}/ /g; $n =~ s/^\s+//; $n =~ s/\s+$//;
  return $n;
}

# wykrywanie destylarni/marki z nazwy
my @BRANDS = (
  ["Buffalo Trace","Buffalo Trace Distillery"],["Eagle Rare","Buffalo Trace Distillery"],
  ["Blanton","Buffalo Trace Distillery"],["Weller","Buffalo Trace Distillery"],
  ["E.H. Taylor","Buffalo Trace Distillery"],["Sazerac","Buffalo Trace Distillery"],
  ["Stagg","Buffalo Trace Distillery"],["Pappy Van Winkle","Old Rip Van Winkle"],
  ["Van Winkle","Old Rip Van Winkle"],["Wild Turkey","Wild Turkey Distillery"],
  ["Russell","Wild Turkey Distillery"],["Russell's","Wild Turkey Distillery"],
  ["Four Roses","Four Roses Distillery"],["Elijah Craig","Heaven Hill Distillery"],
  ["Evan Williams","Heaven Hill Distillery"],["Henry McKenna","Heaven Hill Distillery"],
  ["Larceny","Heaven Hill Distillery"],["Old Fitzgerald","Heaven Hill Distillery"],
  ["Heaven Hill","Heaven Hill Distillery"],["Knob Creek","Jim Beam Distillery"],
  ["Booker","Jim Beam Distillery"],["Basil Hayden","Jim Beam Distillery"],
  ["Baker","Jim Beam Distillery"],["Old Grand","Jim Beam Distillery"],
  ["Jim Beam","Jim Beam Distillery"],["Maker's Mark","Maker's Mark Distillery"],
  ["Maker","Maker's Mark Distillery"],["Michter","Michter's Distillery"],
  ["Bardstown","Bardstown Bourbon Company"],["Old Forester","Old Forester Distillery"],
  ["Woodford","Woodford Reserve Distillery"],["Jefferson","Jefferson's"],
  ["Rare Character","Rare Character Whiskey Co."],["New Riff","New Riff Distillery"],
  ["Angel's Envy","Angel's Envy"],["Willett","Willett Distillery"],
  ["Old Carter","Old Carter"],["Barrell","Barrell Craft Spirits"],
  ["Penelope","Penelope Bourbon"],["Smoke Wagon","Nevada H&C"],
  ["Widow Jane","Widow Jane"],["Garrison Brothers","Garrison Brothers"],
  ["1792","Barton 1792 Distillery"],["David Nicholson","Lux Row"],
  ["Rebel","Lux Row"],["Ezra Brooks","Lux Row"],["Platte Valley","MGP"],
  ["Ransom","Ransom Spirits"],["Calumet","Western Spirits"],
  ["Hudson","Tuthilltown"],["Balcones","Balcones Distilling"],
  ["Wilderness Trail","Wilderness Trail"],["Nulu","Prohibition Craft"],
  ["Old Carter","Old Carter"],["Uncle Nearest","Uncle Nearest"],
);
sub distillery_of {
  my $n = shift;
  for my $b (@BRANDS) { return $b->[1] if index(lc($n), lc($b->[0])) >= 0; }
  (my $g = $n) =~ s/\s*\b\d.*$//; my @w = split /\s+/, $g;
  return @w ? join(' ', @w[0 .. ($#w<1?$#w:1)]) : 'Dom Whisky';
}

# --- wczytaj istniejaca baze, zbuduj zbior znormalizowanych nazw ---
local $/; open my $fh,'<',$db_path or die "db: $!"; my $db=decode_json(<$fh>); close $fh;
my %have; $have{ norm($_->{name}) } = 1 for @{$db->{bottles}};
my %idused; $idused{$_->{id}} = 1 for @{$db->{bottles}};

# --- parsuj strony ---
my (%price, %img, %url, %name);
for my $f (sort glob $pages_glob) {
  open my $p,'<',$f or next; local $/; my $h=<$p>; close $p;
  # gtag: id, name, price (w tym samym obiekcie)
  while ($h =~ /"item_id":"(\d+)","item_name":"([^"]+)"[^}]*?"price":([0-9.]+)/g) {
    my ($id,$nm,$pr)=($1,$2,$3); $nm =~ s/\\\//\//g;
    $name{$id} //= $nm; $price{$id} //= $pr;
  }
  # zdjecia: /hpeciai/<hash>/..-<id>.<ext>  (preferuj eng_il_ duze)
  while ($h =~ m{(/hpeciai/[a-f0-9]+/(eng_i[ls])_[^"]+?-(\d+)\.(jpg|jpeg|png|webp))}g) {
    my ($u,$kind,$id)=($1,$2,$3);
    if (!$img{$id} || ($kind eq 'il' && $img{$id} !~ /eng_il_/)) { $img{$id}=$u; }
  }
  # url produktu
  while ($h =~ m{data-product-id="(\d+)" href="(https://sklep-domwhisky\.pl/product-eng-\d+-[^"]+\.html)"}g) {
    $url{$1} //= $2;
  }
}

# --- buduj rekordy nowych butelek ---
my $SET  = qr/\b\d+\s*x\s*\d|\bx\s*\d+\s*0?\.\d|\bzestaw\b|\bset\b|\bpack\b|\bgift\b|\btrio\b|\bbox\b|szklank|\bglass(?:es)?\b|\+\s*szk/i;
my $MINI = qr/\b(50ml|100ml|200ml|0[.,]05\s*l|0[.,]1\s*l|0[.,]2\s*l|0[.,]35\s*l|miniat)/i;
# nie-bourbony wpadajace czasem do kategorii sklepu ("High Rye Bourbon" zostaje)
my $NOTBOURBON = qr/\brye\s+whiskey\b|\bunblended\s+american\s+whiskey\b|\bcorn\s+whiskey\b|
                    \bsingle\s+malt\b|\bspirit\s+whiskey\b|\bamerican\s+single\s+malt\b/ix;
my (@new, @manifest);
my ($tot,$skip_price,$skip_set,$skip_have,$skip_noimg,$skip_type)=(0,0,0,0,0,0);

for my $id (sort keys %name) {
  $tot++;
  my $raw = $name{$id};
  my $pr  = $price{$id};
  next unless defined $pr;
  if ($pr > 2000)                 { $skip_price++; next; }   # > 2000 zl
  if ($raw =~ $SET || $raw =~ $MINI) { $skip_set++; next; }
  if ($raw =~ $NOTBOURBON)        { $skip_type++; next; }    # nie-bourbon
  my $disp = disp_name($raw);
  next unless length $disp >= 4;
  if ($have{ norm($disp) }) { $skip_have++; next; }          # juz mamy
  my $imgu = $img{$id};
  if (!$imgu) { $skip_noimg++; next; }

  # id docelowe (slug)
  (my $slug = lc $disp) =~ s/[^a-z0-9]+/-/g; $slug =~ s/^-+//; $slug=~s/-+$//;
  $slug = "dw-$id" unless length $slug;
  my $bid = $slug; my $k=2; while ($idused{$bid}++) { $bid="$slug-$k"; $k++; }

  my ($ext) = $imgu =~ /\.([a-z]+)$/; $ext ||= 'jpg';
  push @manifest, "$bid\thttps://sklep-domwhisky.pl$imgu";

  $have{ norm($disp) } = 1;   # zapobiega dublom wewnatrz domwhisky
  push @new, {
    id=>$bid, name=>$disp, distillery=>distillery_of($disp), region=>'USA',
    type=>'Bourbon', category=>'Standard', proof=>undef, abv=>undef, mashbill=>undef,
    price=>$pr+0, price_str=>($pr==int($pr)?int($pr):$pr)." zł", price_pln=>($pr==int($pr)?int($pr):$pr)." zł",
    quality=>undef, value=>undef, notes=>undef, desc=>undef,
    image=>"assets/bourbons/$bid.$ext", status=>'available', source=>'domwhisky',
    url=>($url{$id}//undef), dw_id=>$id,
  };
}

open my $o,'>',$out_json; print $o JSON::PP->new->utf8->canonical->pretty->encode(\@new); close $o;
open my $m,'>',$out_img; print $m "$_\n" for @manifest; close $m;

print "produktow w gtag: $tot\n";
print "odrzucone: >2000zl=$skip_price, zestawy/mini=$skip_set, nie-bourbon=$skip_type, juz_mamy=$skip_have, bez_zdjecia=$skip_noimg\n";
print "NOWYCH do dodania: ", scalar(@new), "\n";
