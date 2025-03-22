#!/bin/bash

# Update the extension files
rsync -av --delete ./ ~/.local/share/gnome-shell/extensions/clipmate@clipmate.github.io/

# Optional: Restart GNOME Shell (uncomment if you want automatic restart)
# If you're on Wayland, this will log you out, so be careful!
# dbus-send --session --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:'global.reexec_self();'

echo "Extension updated. Press Alt+F2, type 'r' and press Enter to restart GNOME Shell." 