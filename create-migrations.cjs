const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const tsPath = path.join(migrationsDir, file);
  const jsPath = path.join(migrationsDir, file.replace('.ts', '.js'));
  
  const content = fs.readFileSync(tsPath, 'utf-8');
  fs.writeFileSync(jsPath, content);
  console.log(`Created ${file.replace('.ts', '.js')}`);
});

console.log(`\n✅ Created ${files.length} migration files`);
