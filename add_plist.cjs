const fs = require('fs');
const xcode = require('xcode');

const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const myProj = xcode.project(projectPath);

myProj.parse(function (err) {
  if (err) {
    console.error('Error parsing pbxproj', err);
    process.exit(1);
  }

  // Add the file to the project
  const pbxGroupKey = myProj.findPBXGroupKey({ path: 'App' }); // Find the main group 'App' by path
  
  // Adding the resource file. This adds it to the PBXBuildFile and PBXFileReference sections,
  // and adds it to the PBXResourcesBuildPhase (so it gets copied to the bundle).
  myProj.addResourceFile('App/GoogleService-Info.plist', { target: myProj.getFirstTarget().uuid }, pbxGroupKey);

  // Write the updated project file back
  fs.writeFileSync(projectPath, myProj.writeSync());
  console.log('Successfully added GoogleService-Info.plist to project.pbxproj');
});
