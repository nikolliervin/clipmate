# ClipMate - GNOME Shell Clipboard Manager

ClipMate is a clipboard manager extension for GNOME Shell that provides a convenient way to access your clipboard history.

## Features

- **Clipboard History**: Remembers the text and images you copy to the clipboard
- **Search**: Easily search through your clipboard history
- **Keyboard Shortcuts**: Quick access with customizable shortcuts
- **Image Support**: Saves and recalls copied images
- **Favorites**: Mark entries as favorites (coming soon)
- **Notifications**: Optional notifications when items are copied
- **Trash Icon**: Delete individual items from history

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/clipmate.git
   ```

2. Install the extension:
   ```
   cd clipmate
   mkdir -p ~/.local/share/gnome-shell/extensions/clipmate@clipmate.github.io
   cp -r * ~/.local/share/gnome-shell/extensions/clipmate@clipmate.github.io/
   ```

3. Restart GNOME Shell:
   - Press `Alt+F2`, type `r`, and press Enter, or
   - Log out and log back in

4. Enable the extension:
   - Use GNOME Extensions app, or
   - Visit https://extensions.gnome.org/local/

## Usage

- Click the clipboard icon in the panel to see your clipboard history
- Press `Super+C` (or your custom shortcut) to show the history at your cursor position
- Press `Alt+Space` as an alternative shortcut
- Type in the search box to filter items
- Click on an item to copy it to clipboard
- Click the trash icon on an item to remove it from history
- Click "Clear History" to remove all items

## Configuration

Open the extension settings to configure:
- History size
- Topbar preview length
- Enable/disable notifications
- Confirmation for clearing history
- Keyboard shortcuts

## License

This extension is distributed under the GNU General Public License v3.0. 