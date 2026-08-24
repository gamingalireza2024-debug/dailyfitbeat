name: gen-food-images
on:
  workflow_dispatch:
    inputs:
      force:
        description: regenerate all (true/false)
        required: false
        default: "false"
permissions:
  contents: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm i sharp
      - name: Add recipes
        run: node scripts/add-recipes.mjs || true
      - name: Heroes
        run: node scripts/heroes.mjs || true
      - name: Generate
        env:
          FORCE: ${{ github.event.inputs.force }}
        run: node scripts/gen-images.mjs
      - name: Commit
        run: |
          git config user.name "dfb-bot"
          git config user.email "bot@dailyfitbeat.app"
          git add img
          git diff --staged --quiet || git commit -m "food images"
          git pull --rebase origin main || true
          git push
