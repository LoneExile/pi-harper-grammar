# VHS tape — regenerate the demo media with:  vhs assets/demo.tape
# (run from the repo root; requires vhs, ttyd, ffmpeg, omp, harper-cli)

Output assets/demo.gif
Output assets/demo.mp4

Set Shell "bash"
Set FontFamily "JetBrainsMono Nerd Font Mono"
Set FontSize 16
Set Width 1100
Set Height 320
Set Padding 24
Set Theme "Catppuccin Mocha"
Set Framerate 24
Set TypingSpeed 55ms

# Launch OMP off-camera and wait for the TUI to be ready.
Hide
Type "cd /tmp/hgdemo && clear && $HOME/.bun/bin/omp --no-session --no-title"
Enter
Sleep 16s
Show

# A messy message → Grammar flags it live below the editor, with an "alt+g to fix" hint.
Sleep 800ms
Type "i dont think its right"
Sleep 3.5s

# The widget shows an "alt+g to fix" hint — one key applies every fix in a real
# terminal. (VHS can't emit the Alt chord, so here we just clear and retype clean.)
Ctrl+U
Sleep 800ms
Type "I don't think it's right."
Sleep 2.5s
