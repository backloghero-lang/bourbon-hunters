#!/usr/bin/perl
# Minimal static file server for local preview/testing (no Node/Python here).
# Serves the repo root on the given port. Not for production.
use strict; use warnings;
use IO::Socket::INET;
$SIG{PIPE} = 'IGNORE';   # don't die when a client closes early
my $port = $ARGV[0] || 8123;
chdir $ARGV[1] if $ARGV[1];   # optional root dir to serve
my %MIME = (
  html=>'text/html; charset=utf-8', js=>'application/javascript; charset=utf-8',
  json=>'application/json; charset=utf-8', css=>'text/css; charset=utf-8',
  webp=>'image/webp', jpg=>'image/jpeg', jpeg=>'image/jpeg', png=>'image/png',
  svg=>'image/svg+xml', ico=>'image/x-icon', webmanifest=>'application/manifest+json',
);
my $srv = IO::Socket::INET->new(LocalAddr=>'127.0.0.1', LocalPort=>$port,
  Proto=>'tcp', Listen=>20, ReuseAddr=>1) or die "bind $port: $!";
$| = 1; print "serving on http://127.0.0.1:$port\n";
$SIG{CHLD} = 'IGNORE';   # reap children automatically
while (1) {
  my $c = $srv->accept or next;
  my $pid = fork();
  if (!defined $pid) { close $c; next; }   # fork failed -> drop
  if ($pid) { close $c; next; }            # parent: keep accepting
  # --- child handles one request then exits ---
  eval {
  my $req = <$c>; $req //= '';
  my ($path) = $req =~ m{^GET\s+(\S+)\s+HTTP}; $path //= '/';
  while (defined(my $h = <$c>)) { last if $h =~ /^\r?\n$/; }   # drain headers
  $path =~ s/\?.*$//; $path = '/index.html' if $path eq '/';
  $path =~ s{\.\.}{}g; (my $f = ".$path") =~ s{^\./}{};
  if (-f $f) {
    my ($ext) = $f =~ /\.([^.]+)$/; my $ct = $MIME{lc($ext//'')} || 'application/octet-stream';
    open my $fh, '<:raw', $f; local $/; my $body = <$fh>; close $fh;
    print $c "HTTP/1.0 200 OK\r\nContent-Type: $ct\r\nContent-Length: ".length($body)."\r\nCache-Control: no-cache\r\n\r\n";
    print $c $body;
  } else {
    my $body = "404 $path"; print $c "HTTP/1.0 404 Not Found\r\nContent-Length: ".length($body)."\r\n\r\n$body";
  }
  };  # end eval
  close $c;
  exit 0;   # child done
}
