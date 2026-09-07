const fs = require('fs');
let pbx = fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');

// 1. Remove from Products group
pbx = pbx.replace(
  'A4825189D8C1FB82D13F8B53 /* GoogleService-Info.plist */,\n\t\t\t\t504EC3041FED79650016851F /* App.app */,',
  '504EC3041FED79650016851F /* App.app */,'
);

// 2. Add to App group (which contains AppDelegate.swift)
pbx = pbx.replace(
  '504EC3071FED79650016851F /* AppDelegate.swift */,',
  'A4825189D8C1FB82D13F8B53 /* GoogleService-Info.plist */,\n\t\t\t\t504EC3071FED79650016851F /* AppDelegate.swift */,'
);

fs.writeFileSync('ios/App/App.xcodeproj/project.pbxproj', pbx);
