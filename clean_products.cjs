const fs = require('fs');
let pbx = fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');

// 1. Remove from Products group safely
pbx = pbx.replace(
  /(\/\* Products \*\/ = \{\s*isa = PBXGroup;\s*children = \(\s*)([\s\S]*?)(\s*504EC3041FED79650016851F \/\* App\.app \*\/,\s*\);\s*name = Products;)/,
  (match, p1, p2, p3) => {
    // p2 contains the children before App.app. Remove GoogleService-Info.plist from it.
    let cleaned = p2.replace(/[ \t]*A4825189D8C1FB82D13F8B53 \/\* GoogleService-Info\.plist \*\/,\r?\n?/, '');
    return p1 + cleaned + p3;
  }
);

fs.writeFileSync('ios/App/App.xcodeproj/project.pbxproj', pbx);
