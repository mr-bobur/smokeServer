'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type LanguageCode = 'uz' | 'en' | 'ru';
export type ThemeMode = 'dark' | 'light';

const translations: Record<LanguageCode, Record<string, string>> = {
  uz: {
    app_title: 'SMART BUILDING SAAS EKOTIZIMI',
    app_subtitle: 'Ko‘p binoli Digital Twin • BLE 5.0 • RS485 • SIM7670 4G • 112 Dispetcher',
    nav_admin: 'Super Admin (SaaS)',
    nav_tenant: 'Shirkat (Tenant) Paneli',
    nav_resident: 'Xonadon (User) Portali',
    switch_role: 'Rolni almashtirish',
    socket_live: 'JONLI ALOQA',
    socket_reconnecting: 'ULANMOQDA...',
    theme_light: 'Yorug‘',
    theme_dark: 'Qorong‘i',

    // Admin Tabs
    tab_topology: '1. Digital Twin va Etaj Topologiyasi',
    tab_buildings: '2. Binolar va Tenantlar (SaaS)',
    tab_devices: '3. Qurilmalar Reestri (Gateways / Hubs / End-Devices)',

    // Buildings & Tenants
    select_building: 'Binoni tanlang',
    create_building: 'Yangi Bino Qo‘shish',
    building_name: 'Bino nomi',
    building_address: 'Bino manzili',
    building_city: 'Shahar',
    floors_count: 'Qavatlar soni',
    assign_tenant: 'Mas’ul Tenant (Shirkat)',
    unassigned: 'Biriktirilmagan',
    save_building: 'Binoni Yaratish',
    add_floor: 'Etaj Qo‘shish',
    add_apartment: 'Xonadon Qo‘shish',
    add_user: 'Foydalanuvchi Qo‘shish',

    // Devices Registry
    devices_gateways: 'Markaziy Gatewaylar (SIM7670 4G)',
    devices_floor_hubs: 'Etaj Hublari (RS485 + BLE)',
    devices_end_nodes: 'Oxirgi Qurilmalar (1 Qurilma = 1 Sensor)',
    single_sensor_rule: 'Har bir oxirgi qurilma faqat 1 ta datchikka ega (Smoke, Temp, Door, CO yoki Glass) va kirish tanishtiruv paketidan (Intro Packet) avtomatik aniqlanadi.',
    add_gateway: 'Yangi Gateway Qo‘shish',
    add_hub: 'Etaj Hubini Sozlash',
    intro_packet: 'Kirish Tanishtiruv Paketi (Intro Hex)',
    parent_receiver: 'Ulangan Hub / Gateway',

    // Drag & Drop Pairing & Intro Packet
    drag_new_device: 'Yangi Qurilma O‘rnatish (Xaritaga tortib tashlang)',
    drag_hint: 'Yangi sotib olingan datchikni xonadon chizmasidagi kerakli joyga tortib tashlang (Drag & Drop) — Hub yoki Gateway avtomatik ulash rejimiga o‘tadi!',
    pairing_mode_active: 'YANGI QURILMA ULASH REJIMI YOQILDI (PAIRING MODE)',
    listening_via_hub: 'Etaj Hubi orqali qidirilmoqda',
    listening_via_gateway: 'Markaziy Gateway orqali to‘g‘ridan-to‘g‘ri qidirilmoqda',
    select_intro_packet: 'Qurilmadan kelayotgan Kirish Tanishtiruv Paketini (Intro Packet) tanlang:',
    complete_intro_pairing: 'Tanishtiruv Paketini Qabul Qilish va O‘rnatish',
    cancel_pairing: 'Bekor qilish',

    // Sensor Types (Strictly 1 per device)
    type_SMOKE_MQ2: 'Tutun datchigi (SMOKE)',
    type_TEMP_DS18B20: 'Harorat datchigi (TEMP)',
    type_DOOR_REED: 'Eshik datchigi (DOOR REED)',
    type_CO_MQ7: 'Is gazi datchigi (CO)',
    type_GLASS_BREAK: 'Oyna sinish datchigi (GLASS)',

    // Resident Portal
    my_apartment: 'Mening Xonadonim Topologiyasi va Xavfsizligi',
    buy_install_title: 'Yangi Qurilma Qo‘shish (Self-Service O‘rnatish)',
    arm_away: 'ARM AWAY (Uydan chiqdim)',
    arm_home: 'ARM HOME (Uydaman)',
    disarm: 'DISARM (O‘chirish)',
    simulate_alarm: 'Yong‘in Signalini Sinash (60s -> 112)'
  },
  en: {
    app_title: 'SMART BUILDING SAAS ECOSYSTEM',
    app_subtitle: 'Multi-Building Digital Twin • BLE 5.0 • RS485 • SIM7670 4G • 112 Dispatch',
    nav_admin: 'Super Admin (SaaS)',
    nav_tenant: 'Tenant (Shirkat) Portal',
    nav_resident: 'Resident (User) Portal',
    switch_role: 'Switch Role',
    socket_live: 'SOCKET + MQTT LIVE',
    socket_reconnecting: 'RECONNECTING...',
    theme_light: 'Light',
    theme_dark: 'Dark',

    tab_topology: '1. Digital Twin & Floor Topology',
    tab_buildings: '2. Buildings & Tenants (SaaS)',
    tab_devices: '3. Devices Registry (Gateways / Hubs / End-Devices)',

    select_building: 'Select Building',
    create_building: 'Create New Building',
    building_name: 'Building Name',
    building_address: 'Street Address',
    building_city: 'City',
    floors_count: 'Number of Floors',
    assign_tenant: 'Assigned Tenant Manager',
    unassigned: 'Unassigned',
    save_building: 'Create Building',
    add_floor: 'Add Floor',
    add_apartment: 'Add Apartment',
    add_user: 'Register User',

    devices_gateways: 'Central Gateways (SIM7670 4G)',
    devices_floor_hubs: 'Floor Sub-Hubs (RS485 + BLE)',
    devices_end_nodes: 'End Devices (1 Device = 1 Sensor)',
    single_sensor_rule: 'Each End-Device carries strictly 1 dedicated sensor (Smoke, Temp, Door, CO, or Glass) auto-detected from its Introduction Handshake Packet.',
    add_gateway: 'Register Gateway',
    add_hub: 'Configure Floor Hub',
    intro_packet: 'Intro Handshake Packet (Hex)',
    parent_receiver: 'Parent Hub / Gateway',

    drag_new_device: 'Install New Device (Drag & Drop onto Map)',
    drag_hint: 'Drag & drop the new device marker onto your apartment topology map — the Floor Hub or Central Gateway will automatically enter Pairing Mode!',
    pairing_mode_active: 'NEW DEVICE PAIRING MODE ACTIVE',
    listening_via_hub: 'Listening via Floor Sub-Hub',
    listening_via_gateway: 'Listening directly via Central Building Gateway',
    select_intro_packet: 'Incoming Hardware Introduction Packet (Auto-Detects Sensor Type):',
    complete_intro_pairing: 'Receive Intro Packet & Complete Installation',
    cancel_pairing: 'Cancel',

    type_SMOKE_MQ2: 'Smoke Detector (SMOKE)',
    type_TEMP_DS18B20: 'Temperature Sensor (TEMP)',
    type_DOOR_REED: 'Door Reed Switch (DOOR)',
    type_CO_MQ7: 'CO Gas Sensor (CO)',
    type_GLASS_BREAK: 'Glass Break Sensor (GLASS)',

    my_apartment: 'My Apartment Topology & Perimeter Security',
    buy_install_title: 'Install New Device (Resident Self-Service)',
    arm_away: 'ARM AWAY (Full Lockdown)',
    arm_home: 'ARM HOME (Stay Mode)',
    disarm: 'DISARM PERIMETER',
    simulate_alarm: 'Simulate Fire Alarm (60s -> 112)'
  },
  ru: {
    app_title: 'SAAS ЭКОСИСТЕМА УМНОГО ЗДАНИЯ',
    app_subtitle: 'Мульти-здания Digital Twin • BLE 5.0 • RS485 • SIM7670 4G • Служба 112',
    nav_admin: 'Супер Админ (SaaS)',
    nav_tenant: 'Панель УК (Ширкат)',
    nav_resident: 'Кабинет Жителя (User)',
    switch_role: 'Сменить роль',
    socket_live: 'ОНЛАЙН СВЯЗЬ',
    socket_reconnecting: 'ПОДКЛЮЧЕНИЕ...',
    theme_light: 'Светлая',
    theme_dark: 'Тёмная',

    tab_topology: '1. Цифровой Двойник и Топология Этажей',
    tab_buildings: '2. Здания и Управляющие (SaaS)',
    tab_devices: '3. Реестр Устройств (Шлюзы / Хабы / Датчики)',

    select_building: 'Выберите здание',
    create_building: 'Создать Здание',
    building_name: 'Название здания',
    building_address: 'Адрес здания',
    building_city: 'Город',
    floors_count: 'Количество этажей',
    assign_tenant: 'Назначенный Тенант (УК)',
    unassigned: 'Не назначен',
    save_building: 'Создать Здание',
    add_floor: 'Добавить Этаж',
    add_apartment: 'Добавить Квартиру',
    add_user: 'Добавить Пользователя',

    devices_gateways: 'Центральные Шлюзы (SIM7670 4G)',
    devices_floor_hubs: 'Этажные Хабы (RS485 + BLE)',
    devices_end_nodes: 'Конечные Устройства (1 Устройство = 1 Сенсор)',
    single_sensor_rule: 'Каждое конечное устройство оснащено строго 1 датчиком (Дым, Температура, Дверь, CO или Стекло), тип которого определяется автоматически из приветственного пакета (Intro Packet).',
    add_gateway: 'Добавить Шлюз',
    add_hub: 'Настроить Этажный Хаб',
    intro_packet: 'Приветственный Пакет (Intro Hex)',
    parent_receiver: 'Родительский Хаб / Шлюз',

    drag_new_device: 'Установить Устройство (Перетащите на план)',
    drag_hint: 'Перетащите новое устройство на план квартиры (Drag & Drop) — Этажный Хаб или Центральный Шлюз автоматически включит режим сопряжения!',
    pairing_mode_active: 'ВКЛЮЧЕН РЕЖИМ СОПРЯЖЕНИЯ (PAIRING MODE)',
    listening_via_hub: 'Поиск через Этажный Суб-Хаб',
    listening_via_gateway: 'Прямой поиск через Центральный Шлюз',
    select_intro_packet: 'Входящий Приветственный Пакет Устройства (Автоопределение типа):',
    complete_intro_pairing: 'Принять Intro-Пакет и Завершить Установку',
    cancel_pairing: 'Отмена',

    type_SMOKE_MQ2: 'Датчик дыма (SMOKE)',
    type_TEMP_DS18B20: 'Датчик температуры (TEMP)',
    type_DOOR_REED: 'Датчик двери (DOOR)',
    type_CO_MQ7: 'Датчик угарного газа (CO)',
    type_GLASS_BREAK: 'Датчик разбития стекла (GLASS)',

    my_apartment: 'Топология и Безопасность Моей Квартиры',
    buy_install_title: 'Установка Нового Устройства (Самообслуживание)',
    arm_away: 'ОХРАНА: ВНЕ ДОМА',
    arm_home: 'ОХРАНА: ДОМА',
    disarm: 'СНЯТЬ С ОХРАНЫ',
    simulate_alarm: 'Тест Пожарной Тревоги (60с -> 112)'
  }
};

interface AppSettingsContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  t: (key: string) => string;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  lang: 'uz',
  setLang: () => {},
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  t: (k) => k
});

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageCode>('uz');
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    const savedLang = localStorage.getItem('sb_lang') as LanguageCode | null;
    if (savedLang && ['uz', 'en', 'ru'].includes(savedLang)) {
      setLangState(savedLang);
    }
    const savedTheme = localStorage.getItem('sb_theme') as ThemeMode | null;
    if (savedTheme && ['dark', 'light'].includes(savedTheme)) {
      setThemeState(savedTheme);
      document.documentElement.classList.toggle('light-mode', savedTheme === 'light');
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
  }, []);

  const setLang = (next: LanguageCode) => {
    setLangState(next);
    localStorage.setItem('sb_lang', next);
  };

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    localStorage.setItem('sb_theme', next);
    document.documentElement.classList.toggle('light-mode', next === 'light');
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const t = (key: string): string => {
    return translations[lang]?.[key] || translations.en[key] || key;
  };

  return (
    <AppSettingsContext.Provider value={{ lang, setLang, theme, setTheme, toggleTheme, t }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => useContext(AppSettingsContext);
