#!/usr/bin/perl
# Czyszczenie bazy: usuwa pozycje > $2000, multipaki, zwija barrel/store picki
# do jednej pozycji na produkt i deduplikuje nazwy.
# Usage: perl scripts/clean_db.pl db/bourbons.json db/bourbons.json
use strict; use warnings; use JSON::PP;

my ($in,$out) = @ARGV;
$in  ||= 'db/bourbons.json';
$out ||= 'db/bourbons.json';

local $/; open my $f,'<',$in or die "in: $!"; my $d=decode_json(<$f>); close $f;
my @b = @{$d->{bottles}};
my $start = scalar @b;

# marker identyfikatora beczki (NIE kasujemy "single barrel select" - to nazwa ekspresji,
# kasujemy tylko to co wskazuje konkretna beczke / wybor sklepowy)
my $PICK = qr/\#\s*\d+|\bselect(?:ed)?\s+by\s+wooden\s*cork\b|\bby\s+wooden\s*cork\b|
              \bwooden\s*cork\b|\bfreddie'?s?\s+choice\b|\bstore\s+pick\b|
              \bprivate\s+(?:select(?:ion)?|barrel|pick)\b|\bhand[\s-]*(?:picked|selected)\b|
              \bbarrel\s*(?:no\.?|\#)\s*\d+|\bbarrel\s+pick\b|
              \bbatch\s*\#?\s*[a-z]?-?\d+\b|\#[a-z]\d+/ix;

# zestawy / multipaki (do usuniecia w calosci)
my $SET = qr/\b\d+\s*[-]?\s*pack\b|\b\d+\s*pk\b|\bpk\b|\btrio\b|\bduo\b|\bbundle\b|
             \bcombo\b|\bgift\s*set\b|\ballocated\s+(?:trio|duo|set|pack)\b/ix;
# uszkodzone / smieciowe listingi
my $JUNK = qr/\bblooper\b|\bbroken\s+wax\b|see\s+description/ix;

sub is_pick { my $n=shift; return $n =~ $PICK ? 1 : 0; }

# usun markery picka z nazwy -> czysta nazwa do wyswietlenia
sub strip_pick {
  my $n = shift;
  $n =~ s/$PICK//g;
  $n =~ s/"[^"]*"//g;                 # cudzyslowowe przydomki ("Freddie's Choice")
  $n =~ s/\s*[-–]\s*$//;
  $n =~ s/\s{2,}/ /g; $n =~ s/^\s+//; $n =~ s/\s+$//;
  $n =~ s/\s*[-–]\s*$//;
  return $n;
}

# klucz bazowy do grupowania (po usunieciu picka, rozmiaru, proof, interpunkcji)
sub base_key {
  my $n = lc strip_pick(shift);
  $n =~ s/\b\d+(?:\.\d+)?\s*(?:ml|l)\b//g;
  $n =~ s/\b\d+(?:\.\d+)?\s*proof\b//g;
  $n =~ s/\b\d+(?:\.\d+)?\s*%//g;
  $n =~ s/\b\d+\.\d+\b//g;                       # bare proof/abv decimals (np. 135.6) - wieki sa calkowite
  $n =~ s/\b(?:kentucky|straight|bourbon|whiskey|whisky|the)\b//g; # slowa wypelniacze
  $n =~ s/[^a-z0-9]+/ /g; $n =~ s/\s+/ /g; $n =~ s/^\s+//; $n =~ s/\s+$//;
  return $n;
}

# 1) usun > $2000, zestawy/multipaki, smieciowe listingi
my ($rm_price,$rm_pack,$rm_junk)=(0,0,0);
my @keep;
for my $x (@b) {
  if (defined $x->{price} && $x->{price} > 2000) { $rm_price++; next; }
  if ($x->{name} =~ $SET)  { $rm_pack++; next; }
  if ($x->{name} =~ $JUNK) { $rm_junk++; next; }
  push @keep, $x;
}

# 2) grupuj wg klucza bazowego, zostaw 1 reprezentanta
my %grp;
push @{$grp{ base_key($_->{name}) }}, $_ for @keep;

sub pick_rep {
  my @g = @_;
  # preferuj: bez markera picka, potem z ocena kuratorska, potem najtanszy, potem krotsza nazwa
  my @sorted = sort {
       (is_pick($a->{name}) <=> is_pick($b->{name}))
    || ((defined $b->{value}?1:0) <=> (defined $a->{value}?1:0))
    || (($a->{price}//9e9) <=> ($b->{price}//9e9))
    || (length($a->{name}) <=> length($b->{name}))
  } @g;
  return $sorted[0];
}

my @final; my $collapsed=0;
for my $k (sort keys %grp) {
  my @g = @{$grp{$k}};
  my $rep = pick_rep(@g);
  $collapsed += (scalar(@g) - 1);
  # jesli reprezentant to pick, wyczysc jego nazwe do bazowej
  if (is_pick($rep->{name})) {
    my $clean = strip_pick($rep->{name});
    $rep->{name} = $clean if length $clean > 3;
  }
  push @final, $rep;
}

# 3) sort wg destylarni + nazwy
@final = sort { ($a->{distillery} cmp $b->{distillery}) || ($a->{name} cmp $b->{name}) } @final;

$d->{bottles} = \@final;
$d->{count}   = scalar @final;
my @t=localtime; $d->{updated}=sprintf('%04d-%02d-%02d',$t[5]+1900,$t[4]+1,$t[3]);

my $json = JSON::PP->new->utf8->canonical->pretty->space_before(0)->indent_length(2);
open my $o,'>',$out or die "out: $!"; print $o $json->encode($d); close $o;

print "start=$start  usunieto: cena>\$2000=$rm_price, zestawy/multipaki=$rm_pack, smieci(blooper)=$rm_junk, zwiniete_picki/dupy=$collapsed\n";
print "po czyszczeniu: ", scalar(@final), "\n";
