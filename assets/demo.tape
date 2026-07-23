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

# A grammatically messy message → Harper flags it live in a widget below the editor.
Sleep 800ms
Type "This are a test with an mistake and he go there"
Sleep 3.5s

# Fix it → the widget clears once the input is clean.
Ctrl+U
Sleep 1s
Type "This is a well-written sentence."
Sleep 2.5s
