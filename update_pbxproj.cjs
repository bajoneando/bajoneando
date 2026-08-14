const fs = require('fs');
const path = 'ios/App/App.xcodeproj/project.pbxproj';
let content = fs.readFileSync(path, 'utf8');

// Replace Automatic with Manual
content = content.replace(/CODE_SIGN_STYLE = Automatic;/g, 'CODE_SIGN_STYLE = Manual;');

// Add signing settings after CODE_SIGN_STYLE
content = content.replace(
  /CODE_SIGN_STYLE = Manual;/g,
  'CODE_SIGN_STYLE = Manual;\n\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";\n\t\t\t\tDEVELOPMENT_TEAM = JHVX9U858F;\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "Wepi_AppStore_Profile";'
);

fs.writeFileSync(path, content);
console.log('project.pbxproj updated successfully.');
