const fs = require('fs');
const path = require('path');

function patchDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      patchDir(fullPath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Remove legacy Animated import and usage
      content = content.replace(/require\(['"]react-native['"]\)\.Animated/g, 'null');
      content = content.replace(/from ['"]react-native['"];?\n?((.|\n)*?)Animated/g, 'from "react-native";');
      content = content.replace(/Animated\./g, 'null.');
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  });
}

patchDir('node_modules');
console.log('Patched all legacy Animated usage in node_modules.'); 