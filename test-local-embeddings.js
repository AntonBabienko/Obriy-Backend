/**
 * Тест локальних embeddings
 * Запустіть: node test-local-embeddings.js
 */

import { testLocalEmbeddings } from './src/services/localEmbeddings.ts';

console.log('🧪 Тестування локальних embeddings...\n');

testLocalEmbeddings()
    .then(() => {
        console.log('\n✅ Всі тести пройдено успішно!');
        console.log('💡 Локальні embeddings готові до використання!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Помилка тестування:', error);
        process.exit(1);
    });
