# Better Doubao Testing Instructions

## 1. Test Accounts

**Test Account**: No special account required
- This extension is built for Doubao web version, any Doubao user can use it directly
- No additional registration or login needed
- Extension features work directly on existing Doubao chat pages

## 2. Testing Steps

### Basic Features
1. Open Doubao website https://www.doubao.com and log in
2. Click the extension icon in the browser toolbar to confirm it's enabled
3. Start normal conversations to verify all features

### Locator Features
1. Open a long conversation with at least 20 user messages
2. Locator dots will appear on the right side of the page
3. Scroll from the top to the bottom and confirm earlier locator dots remain available
4. From the bottom, click the first locator dot and confirm the matching message is restored and highlighted
5. The locator list will automatically scroll to center the selected dot

### Folder Management
1. Expand the Legacy Folders section in the left sidebar and confirm existing folders remain available
2. Click the "+" button to create a new folder
3. Choose a preset color or custom color in the color picker
4. Drag conversations into the folder
5. Use the folder menu to rename it, change its color, or delete it
6. Switch conversations or workspaces and confirm the Folder section remains available

### Sidebar Shortcuts
1. Confirm common actions appear as a row of icons while native Projects remains separate
2. Hover or focus each icon and confirm its name appears
3. Click each icon and confirm the corresponding native Doubao action still works

### Corpus Board Features
1. Select conversation text and use the floating button to add it to the Corpus Board
2. Confirm the Corpus Board button appears near the input area and remains on screen
3. Select a saved snippet and insert it into the input area
4. Resize the browser window and confirm the button stays within the viewport

## 3. Dependencies

- **Doubao Web**: This extension runs entirely on Doubao official website, cannot be used without Doubao account
- **Browser**: Supports Chrome and Edge
- **Network**: Requires active internet connection to access Doubao servers

## Notes

- This extension is a client-side enhancement tool, does not collect or upload any user data
- All data is stored locally in the user's browser
- The extension will not affect Doubao's normal operation
