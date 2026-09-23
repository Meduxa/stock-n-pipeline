/* ==========================================
   ⚙️ კონფიგურაცია — ყველა მყარად ჩაწერილი მნიშვნელობა ერთ ადგილას
   ========================================== */

// Firebase-ის ვებ-კონფიგურაცია საიდუმლო არ არის — ის ყოველთვის ბრაუზერში ჩანს.
// მონაცემების რეალური დაცვა უზრუნველყოფილია Firestore-ის წესებით (იხ. firestore.rules).
const firebaseConfig = {
    apiKey: "AIzaSyCxFp5npK0n2RzdzLRq960iofFzM_Hq_8o",
    authDomain: "stockpipeline-2c77b.firebaseapp.com",
    projectId: "stockpipeline-2c77b",
    storageBucket: "stockpipeline-2c77b.firebasestorage.app",
    messagingSenderId: "315106209502",
    appId: "1:315106209502:web:19faf93c79edcdb9ec1c4f",
    measurementId: "G-J3E1KREV0N"
};

// UI-ში ადმინის ფუნქციების ჩვენება. ⚠️ ეს მხოლოდ ინტერფეისს მართავს —
// იგივე სია უნდა იყოს firestore.rules-ში, წინააღმდეგ შემთხვევაში დაცვა არ მუშაობს.
const ADMIN_EMAILS = ["levan.medoshvili@gmail.com", "tornike.a@tbilisimedic.ge", "beqa.b@tbilisimedic.ge"];

const STORAGE_BASE_URL = "https://firebasestorage.googleapis.com/v0/b/stockpipeline-2c77b.firebasestorage.app/o/products%2F";
const storageUrl = fileName => `${STORAGE_BASE_URL}${encodeURIComponent(fileName)}?alt=media`;
const COMPANY_LOGO_URL = storageUrl("mediclogo.png");

const COMPANY = {
    name: "შპს „თბილისი მედიკ“",
    idCode: "404865286",
    address: "ქ. თბილისი, ლუბლიანას ქ. #28ა",
    phone: "2375177",
    email: "info@tbilisimedic.ge",
    bank: "ს.ს. „თიბისი ბანკი“",
    iban: "GE68TB7031036020100007",
    bankCode: "TBCBGE22",
    director: "მაია ზანგურაშვილი"
};

const DEFAULT_USD_RATE = 2.75;

// Firestore-ის დოკუმენტის ლიმიტი 1MB-ია და ფაილები base64-ით ~33%-ით იზრდება,
// ამიტომ ერთი მიმაგრებული ფაილი ამაზე დიდი ვერ იქნება.
const MAX_ATTACHMENT_BYTES = 600 * 1024;
