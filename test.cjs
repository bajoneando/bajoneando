const xcode = require('xcode');
const myProj = xcode.project('ios/App/App.xcodeproj/project.pbxproj');
myProj.parseSync();
const groups = myProj.hash.project.objects.PBXGroup;
for (const key in groups) {
  if (groups[key] && typeof groups[key] === 'object') {
    console.log(key, groups[key].name || groups[key].path);
  }
}
