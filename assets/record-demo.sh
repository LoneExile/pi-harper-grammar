#!/usr/bin/env bash
# Regenerate assets/demo.gif + assets/demo.mp4.
#
# Recorded from a REAL terminal (not VHS): VHS runs inside ttyd/xterm.js, which
# drops the Alt/Meta modifier, so it cannot emit the alt+g chord. We drive a real
# OMP session inside tmux (where `send-keys M-g` delivers alt+g correctly),
# record it with asciinema, then render to GIF/MP4 with agg + ffmpeg.
#
# Requires: tmux, asciinema, agg, ffmpeg, omp, harper-cli, and the
# "JetBrainsMono Nerd Font Mono" font installed.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
cast="$(mktemp -t harper-demo).cast"
work="/tmp/grammar-demo"
rm -rf "$work"; mkdir -p "$work" && git -C "$work" init -q

tmux kill-session -t hgcap 2>/dev/null || true
tmux new-session -d -s hgcap -x 110 -y 16
tmux send-keys -t hgcap "asciinema rec --overwrite --window-size 110x16 '$cast' -c 'omp --no-session --no-title --cwd $work'" Enter
sleep 16                                   # let OMP boot
# Type the message one character at a time, like a person.
msg='i dont think its right'
for (( i=0; i<${#msg}; i++ )); do
  tmux send-keys -t hgcap -l "${msg:i:1}"
  sleep 0.09
done
sleep 2.4                                  # pause so viewers can read the flagged issues
tmux send-keys -t hgcap M-g                # the real alt+g chord → applies fixes
sleep 2.6                                  # fix applies; poll re-checks and clears the widget — hold so it's readable
kill -INT "$(pgrep -f 'asciinema rec' | head -1)"   # stop on the clean state (no input-clear)
sleep 2
tmux kill-session -t hgcap 2>/dev/null || true

agg --font-family "JetBrainsMono Nerd Font Mono" --font-size 18 --theme dracula \
    --idle-time-limit 2 --speed 1 "$cast" "$here/demo.gif"
ffmpeg -y -i "$here/demo.gif" -movflags +faststart -pix_fmt yuv420p \
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "$here/demo.mp4"

echo "wrote $here/demo.gif and $here/demo.mp4"
