const fs = require('fs');
const path = require('path');

// Файл для обработки
const filePath = path.join(__dirname, 'src/components/hub/chat/MainChatArea.tsx');

// Создаем резервную копию
const backupPath = filePath + '.backup';
fs.copyFileSync(filePath, backupPath);
console.log(`Created backup at ${backupPath}`);

// Считываем содержимое файла
let content = fs.readFileSync(filePath, 'utf8');

// Шаблоны для поиска
const patterns = [
  // Простые логи
  /console\.log\([^;]+;/g,
  // Многострочные логи
  /console\.log\([^;]*\}\);/g,
  // Ошибки и предупреждения
  /console\.(error|warn)\([^;]+;/g,
  // Группы
  /console\.group[^;]*;/g,
  /console\.groupEnd[^;]*;/g
];

// Проходим по всем шаблонам
patterns.forEach(pattern => {
  let match;
  let matches = [];
  
  // Находим все совпадения
  while ((match = pattern.exec(content)) !== null) {
    matches.push(match[0]);
  }
  
  // Заменяем каждое совпадение
  matches.forEach(match => {
    console.log(`Removing: ${match.substring(0, 50)}...`);
    content = content.replace(match, '');
  });
});

// Сохраняем файл
fs.writeFileSync(filePath, content);
console.log('Console statements removed!');