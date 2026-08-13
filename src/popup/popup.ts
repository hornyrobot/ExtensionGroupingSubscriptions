import "./popup.css";

import type { Group } from "../models/Group";
import { StorageService } from "../storage/storage";


// надо добавить отображение введённых групп, их сохранение куда то, 
// сохранение после перезахода, и css для всего этого - css узнать создаётся ли в отдельных файлах (чтоб в html ток ссылка)

//--------------------------- Переменные
let numId: number = 0;


// массив обьектов с типов групп (не меняем константа, только читаем)
const groups: Group[] = [];


//--------------------------- Функции и метода
//функция для содания группы
function createGroup(name: string): Group {
    const group: Group = {
        id: numId++,
        name: name,
        date: Date.now()
    }

    return group;
}



function renderGroup(): void {
    const groupList = document.getElementById("groupList");

    if (!groupList) {
        console.error("element of group list is not found");
        return;
    }

    groupList.innerHTML = "";

    if (groups.length === 0) {
        // ✅ Используем div или p для сообщения
        const message = document.createElement('div');
        message.className = 'empty-message';
        message.textContent = 'Нет созданных групп';
        groupList.appendChild(message);
        return;
    }

    // ✅ Используем li для элементов списка
    for (const group of groups) {
        const li = document.createElement("li");
        li.textContent = group.name;

        // Форматируем дату
        const date = new Date(group.date).toLocaleString('ru-RU');

        // 🔹 Создаём структуру элемента
        li.innerHTML = `
            <div class="group-info">
                <span class="group-name"><strong>${group.id}.</strong> ${group.name}</span>
                <small class="group-date">${date}</small>
            </div>
            
            <!-- 🔹 Кнопка удаления для ЭТОЙ группы -->
            <button class="delete-btn" data-id="${group.id}">✕ Удалить</button>
        `;


        groupList.appendChild(li);
    }

    addDeleteHandlers();
}

// 🔹 Функция добавления обработчиков удаления
function addDeleteHandlers(): void {
    const deleteButtons = document.querySelectorAll('.delete-btn');

    deleteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target as HTMLButtonElement;
            const groupId = Number(target.dataset.id);
            deleteGroup(groupId);
        });
    });
}

// 🔹 Функция удаления группы
async function deleteGroup(id: number): Promise<void> {
    // Находим индекс группы
    const index = groups.findIndex(g => g.id === id);

    if (index !== -1) {
        // Удаляем из массива
        const removedGroup = groups.splice(index, 1)[0];

        //сохраняем изменения в массиве и сделали метод асинхронным
        try {

            await StorageService.saveGroups(groups);

        }
        catch (error) {

            console.error(error);

        }

        // Перерисовываем список
        renderGroup();

        // Показываем в консоли
        // console.log(`🗑️ Группа "${removedGroup.name}" удалена`);
        console.log(`🗑️ Группа "${removedGroup}" удалена`);
        console.log('📋 Осталось групп:', groups);
    }
}

//---------------------------




//--------------------------- Работа с http 


//первая отрисовка сч пустым списком 
document.addEventListener("DOMContentLoaded", async () => {

    //загрузка из хранилища, асинхронно
    const savedGroups = await StorageService.loadGroups();

    groups.push(...savedGroups);


    // вычисляем новые ip
    if (groups.length > 0) {
        numId = Math.max(...groups.map(g => g.id)) + 1;
    }

    renderGroup();

});

// нажати на кнопку
const button = document.getElementById("button");

button?.addEventListener("click", () => {
    // Открываем скрытое поле - класс hidden тоглим (переключаем)
    input?.classList.toggle('hidden');

    // Переводим курсор в поле 
    if (!input?.classList.contains('hidden')) {
        input?.focus();
    }

});

// после нажатия отображение 
const input = document.getElementById('groupInput') as HTMLInputElement;;


input?.addEventListener('keypress', async (e) => {
    if ((e.key) == 'Enter') {

        const groupName = input.value.trim();  // Убираем пробелы по краям

        if (groupName) {
            // 🔹 Создаём группу и добавляем в массив
            const newGroup = createGroup(groupName);
            groups.push(newGroup);

            //сделали обработчик асинхронным
            try {

                await StorageService.saveGroups(groups);

            }
            catch (error) {

                console.error(error);

            }

            // Отрисовываем группу
            renderGroup();

            // Показываем результат
            console.log('✅ Группа создана:', newGroup);
            console.log('📋 Все группы:', groups);

            // Визуальное подтверждение
            alert(`Группа "${groupName}" создана! ID: ${newGroup.id}`);

            // Очищаем поле и скрываем
            input.value = '';
            input.classList.add('hidden');
        } else {
            alert('Введите название группы!');
        }

    }


});


