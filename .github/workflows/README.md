# GitHub Actions Workflows

## deploy.yml

Automated deployment workflow for Scripta Manent to GitHub Pages.

### Triggers

- **Push to `main` branch**: Deploys as version "latest"
- **Push to `release/*` branches**: Deploys with version name from branch (e.g., `release/v1.1` → version "v1.1")
- **Manual trigger**: Can be triggered manually from the Actions tab

### What it does

1. **Build**: 
   - Checks out the repository
   - Copies `src/` directory to `dist/VERSION/`
   - Updates version number in manifest.json
   
2. **Deploy**:
   - Uploads the built files as a GitHub Pages artifact
   - Deploys to GitHub Pages

### Access URLs

After deployment, the app will be available at:
- Latest: `https://milleisole.github.io/scripta-manent/dist/latest/index.html`
- Specific version: `https://milleisole.github.io/scripta-manent/dist/VERSION/index.html`

### Requirements

- GitHub Pages must be enabled in repository settings
- Source must be set to "GitHub Actions"

### Permissions

The workflow requires:
- `contents: read` - to checkout the repository
- `pages: write` - to deploy to GitHub Pages
- `id-token: write` - for GitHub Pages deployment authentication
