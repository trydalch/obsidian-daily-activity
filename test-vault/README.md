# Test Vault for Daily Activity Plugin

This is a test vault for developing and testing the Obsidian Daily Activity Plugin. It provides a consistent environment for plugin development and testing.

## Setup

1. Open this vault in Obsidian:
   - Launch Obsidian
   - Click "Open another vault"
   - Select "Open folder as vault"
   - Navigate to this `test-vault` directory

2. Enable the plugin:
   - Go to Settings > Community Plugins
   - Turn off "Safe Mode" if enabled
   - Enable "Daily Activity Plugin" under "Installed plugins"


## Development

When you run `npm run dev-deploy`, the plugin will be automatically copied to this vault's plugins directory. You can then test the plugin functionality directly in this vault.

## Notes

- This vault is included in the repository to ensure consistent development environment
- Workspace settings and other personal Obsidian configurations are gitignored
- Only the plugin-specific files and test data will be tracked in git 
