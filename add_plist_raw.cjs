const fs = require('fs');
const crypto = require('crypto');

const generateUUID = () => crypto.randomBytes(12).toString('hex').toUpperCase();

const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
let pbx = fs.readFileSync(projectPath, 'utf8');

if (pbx.includes('GoogleService-Info.plist')) {
  console.log('Already added');
  process.exit(0);
}

const fileRefUUID = generateUUID();
const buildFileUUID = generateUUID();

// Add to PBXBuildFile
pbx = pbx.replace(
  '/* Begin PBXBuildFile section */',
  `/* Begin PBXBuildFile section */\n\t\t${buildFileUUID} /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = ${fileRefUUID} /* GoogleService-Info.plist */; };`
);

// Add to PBXFileReference
pbx = pbx.replace(
  '/* Begin PBXFileReference section */',
  `/* Begin PBXFileReference section */\n\t\t${fileRefUUID} /* GoogleService-Info.plist */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };`
);

// Add to main App group (search for path = App)
const appGroupRegex = /(path = App;[\s\S]*?children = \([\s\S]*?)(\);)/;
pbx = pbx.replace(appGroupRegex, `$1\t\t\t\t${fileRefUUID} /* GoogleService-Info.plist */,\n\t\t\t$2`);

// Add to PBXResourcesBuildPhase
const resourcesRegex = /(isa = PBXResourcesBuildPhase;[\s\S]*?files = \([\s\S]*?)(\);)/;
pbx = pbx.replace(resourcesRegex, `$1\t\t\t\t${buildFileUUID} /* GoogleService-Info.plist in Resources */,\n\t\t\t$2`);

fs.writeFileSync(projectPath, pbx);
console.log('Added via raw string replacement');
