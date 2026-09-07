const fs = require('fs');
let pbx = fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');

const buildFileStr = '\n\t\t9BE45370D117F93ECA82C208 /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = A4825189D8C1FB82D13F8B53 /* GoogleService-Info.plist */; };';
pbx = pbx.replace(/\/\* Begin PBXBuildFile section \*\//, '/* Begin PBXBuildFile section */' + buildFileStr);

const fileRefStr = '\n\t\tA4825189D8C1FB82D13F8B53 /* GoogleService-Info.plist */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };';
pbx = pbx.replace(/\/\* Begin PBXFileReference section \*\//, '/* Begin PBXFileReference section */' + fileRefStr);

pbx = pbx.replace(/(504EC3061FED79650016851F[\s\S]*?children\s*=\s*\()/, '$1\n\t\t\t\tA4825189D8C1FB82D13F8B53 /* GoogleService-Info.plist */,');

pbx = pbx.replace(/(504EC3021FED79650016851F[\s\S]*?files\s*=\s*\()/, '$1\n\t\t\t\t9BE45370D117F93ECA82C208 /* GoogleService-Info.plist in Resources */,');

fs.writeFileSync('ios/App/App.xcodeproj/project.pbxproj', pbx);
