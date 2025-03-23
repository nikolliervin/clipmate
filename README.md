# ClipMate - GNOME Shell Clipboard Manager

ClipMate is a clipboard manager extension for GNOME Shell that provides a convenient way to access your clipboard history.

## Features

- **Clipboard History**: Remembers the text and images you copy to the clipboard
- **Search**: Easily search through your clipboard history
- **Keyboard Shortcuts**: Quick access with customizable shortcuts
- **Image Support**: Saves and recalls copied images
- **Favorites**: Mark entries as favorites for quick access
- **Incognito Mode**: Temporarily stop recording clipboard items for privacy
- **Notifications**: Optional notifications when items are copied
- **Trash Icon**: Delete individual items from history
- **Backup/Restore**: Export and import your clipboard history to JSON files

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/nikolliervin/clipmate.git
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
- Click the star icon to mark an item as a favorite (it will appear at the top)
- Click the trash icon on an item to remove it from history
- Toggle "Incognito Mode" to temporarily stop recording clipboard items (the icon changes to a lock)
- Click "Export Clipboard History" to save a backup file
- Click "Import Clipboard History" to restore from a backup file
- Click "Clear History" to remove all items

## Configuration

Open the extension settings to configure:
- History size
- Topbar preview length
- Enable/disable notifications
- Confirmation for clearing history
- Keyboard shortcuts

## Backup and Restore

ClipMate allows you to export and import your clipboard history:

### Exporting
1. Click on the clipboard icon in the panel (or press the shortcut key)
2. Click "Export Clipboard History"
3. The backup will be saved as `clipmate_backup_YYYY-MM-DD_HH-MM.json` in your home directory
4. You'll receive a notification with the exact path

### Importing
1. Click on the clipboard icon in the panel (or press the shortcut key)
2. Click "Import Clipboard History"
3. Follow the instructions in the dialog:
   - Find your backup file in your home directory
   - Rename it to `clipmate_backup.json` 
   - Make sure it's in your home directory
   - Click "Import"
4. Your clipboard history will be restored from the backup

## Showcase
![Screenshot from 2025-03-22 21-23-24](https://github.com/user-attachments/assets/d90fe361-3a62-4000-9df3-95d73710ff85)

![Screenshot from 2025-03-22 21-24-25](https://github.com/user-attachments/assets/d69cdcef-5281-457d-9322-dfa3a7e8f001)

![Screenshot from 2025-03-22 21-25-06](https://github.com/user-attachments/assets/4874a19f-ae4e-4ae0-a2af-f146d3324fcd)

## License

This extension is distributed under the MIT License. 
