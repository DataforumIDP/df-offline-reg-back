import axios from 'axios';
import async from 'async';
import { saveFileAndReturnInfo } from '../saveFileAndReturnInfo';
import { wrap } from '../../../../utils/wrap';

// Основной хелпер для экспорта фотографий
/**
 * Импортирует изображения с публичной ссылки Яндекс.Диска и загружает их в S3.
 *
 * @param {string} yandexDiskPublicUrl - Публичная ссылка на ресурс Яндекс.Диска.
 * 
 * @returns {Promise<any[]>} Массив объектов с информацией о загруженных файлах.
 * 
 * @throws {Error} Если не удалось получить файлы с Яндекс.Диска или произошла ошибка при загрузке файлов в S3.
 * 
 * @remarks
 * - Поддерживаются только файлы с расширениями `.jpg`, `.jpeg`, `.png`.
 * - Используется ограничение на количество параллельных загрузок в S3 (по умолчанию 5).
 * - Файлы загружаются с учетом пагинации (максимум 100 элементов за один запрос).
 * 
 * @example
 * ```typescript
 * const yandexDiskUrl = 'https://disk.yandex.ru/d/some-public-key';
 * const uploadedFiles = await importFromYandex(yandexDiskUrl);
 * console.log('Загруженные файлы:', uploadedFiles);
 * ```
 */
export async function importFromYandex(yandexDiskPublicUrl: string) {
  const YANDEX_DISK_API_URL = 'https://cloud-api.yandex.net/v1/disk/public/resources';
  const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
  const MAX_PARALLEL_UPLOADS = 2; // Лимит параллельных загрузок в S3

  const allPhotos: any[] = [];
  let items: any[] = [];
  let offset = 0;
  const limit = 100; // Максимальное количество элементов за один запрос

  // Получаем все файлы с учетом пагинации
  do {
    const [data] = await wrap(
      axios.get(YANDEX_DISK_API_URL, {
        params: {
          public_key: yandexDiskPublicUrl,
          limit,
          offset,
        },
      })
    );

    if (data === null) {
      throw 'Не удалось получить файлы с Яндекс.Диска';
    }

    // Сохраняем текущую порцию файлов
    items = data.data._embedded.items;

    // Фильтруем только поддерживаемые типы файлов
    const photoFiles = items.filter((item: any) => {
      const ext = item.name.toLowerCase().split('.').pop();
      return SUPPORTED_EXTENSIONS.includes(`.${ext}`);
    });

    allPhotos.push(...photoFiles);

    // Увеличиваем смещение для следующего запроса
    offset += limit;

    // Прекращаем цикл, если достигнут конец списка
  } while (items.length === limit);

  if (allPhotos.length === 0) {
    throw 'Поддерживаемые изображения не найдены.';
  }

  // Создаем очередь для параллельной обработки
  const results: any[] = [];
  const queue = async.queue(async (file: any, callback) => {
    try {
      const fileUrl = file.file;
      const [fileResponse] = await wrap(
        axios.get(fileUrl, { responseType: 'arraybuffer' })
      );

      if (!fileResponse) {
        throw `Ответ на запрос файла равен null для файла ${file.name}`;
      }
      const fileBuffer = Buffer.from(fileResponse.data);

      // Загрузка файла в S3
      const [uploadResult, uploadError] = await wrap(
        saveFileAndReturnInfo(fileBuffer, file.name)
      );

      if (uploadResult === null) {
        console.error(`Ошибка при загрузке файла ${file.name}:`, uploadError);
        throw uploadError;
      }

      console.log(uploadResult );
      

      console.log(`Файл загружен: ${file.name}`);
      results.push(uploadResult); // Сохраняем результат загрузки
      callback();
    } catch (error) {
      console.error(`Ошибка при обработке файла ${file.name}:`, error);
      callback(error);
    }
  }, MAX_PARALLEL_UPLOADS);

  // Добавляем все файлы в очередь
  queue.push(allPhotos);

  // Ждем завершения всех задач
  await queue.drain();

  console.log('Все файлы обработаны.');
  return results;
}