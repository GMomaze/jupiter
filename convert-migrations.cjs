const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Parse the CommonJS structure
  const match = content.match(/module\.exports\s*=\s*\{([\s\S]*)\};/);
  if (!match) {
    console.log(`Skipping ${file} - no module.exports found`);
    return;
  }
  
  const bodyMatch = match[1].match(/async\s+up\s*\(queryInterface,\s*Sequelize\)\s*\{([\s\S]*?)\},\s*async\s+down\s*\(queryInterface,\s*Sequelize\)\s*\{([\s\S]*)\}/);
  
  if (!bodyMatch) {
    console.log(`Skipping ${file} - couldn't parse up/down functions`);
    return;
  }
  
  const upBody = bodyMatch[1];
  const downBody = bodyMatch[2];
  
  const converted = `export const up = async (queryInterface, Sequelize) => {${upBody}};\n\nexport const down = async (queryInterface, Sequelize) => {${downBody}};`;
  
  fs.writeFileSync(filePath, converted);
  console.log(`Converted ${file}`);
});

console.log('Done');
