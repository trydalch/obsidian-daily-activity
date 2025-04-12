import { readFileSync, writeFileSync } from "fs";

// Read minAppVersion from manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const minAppVersion = manifest.minAppVersion;
const currentVersion = manifest.version;

// Update version in manifest.json (package.json version update is handled by npm version)
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const newVersion = packageJson.version;
manifest.version = newVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2));

// Update versions.json with the new version -> minAppVersion mapping
let versions = {};
try {
    versions = JSON.parse(readFileSync("versions.json", "utf8"));
} catch (e) {
    console.log("Could not find versions.json, creating a new one");
}
versions[newVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, 2));

console.log(`Updated version to ${newVersion} with minAppVersion ${minAppVersion}`); 