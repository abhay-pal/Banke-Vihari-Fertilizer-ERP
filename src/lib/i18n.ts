export const dictionary = {
  en: {
    dashboard: 'Dashboard', pos: 'New sale', sales: 'Sales history', customers: 'Customers & Khata', collections: 'Receive payment', purchases: 'Purchases', suppliers: 'Suppliers', products: 'Product master', inventory: 'Inventory & stock', expenses: 'Expenses & cashbook', reports: 'Reports & analytics', users: 'User management', settings: 'Settings',
    todaySales: "Today's sales", cashSales: 'Cash sales', upiSales: 'UPI sales', creditSales: 'Credit sales', collectionsToday: "Today's collections", grossProfit: 'Gross profit', monthlySales: 'Monthly sales', monthlyProfit: 'Monthly profit', customerOutstanding: 'Customer outstanding', supplierOutstanding: 'Supplier outstanding', inventoryValue: 'Inventory value', lowStock: 'Low stock', expiring: 'Expiring soon', expensesToday: "Today's expenses",
    createSale: 'Create sale', newPurchase: 'New purchase', addProduct: 'Add product', addCustomer: 'Add customer', viewAll: 'View all', search: 'Search', noRecords: 'No records yet', noRecordsHint: 'Once you connect your business data, records will appear here.',
  },
  hi: {
    dashboard: 'डैशबोर्ड', pos: 'नई बिक्री', sales: 'बिक्री इतिहास', customers: 'ग्राहक और उधार खाता', collections: 'भुगतान प्राप्त करें', purchases: 'खरीद', suppliers: 'आपूर्तिकर्ता', products: 'उत्पाद सूची', inventory: 'स्टॉक और भंडार', expenses: 'खर्च और कैशबुक', reports: 'रिपोर्ट और विश्लेषण', users: 'उपयोगकर्ता प्रबंधन', settings: 'सेटिंग्स',
    todaySales: 'आज की बिक्री', cashSales: 'नकद बिक्री', upiSales: 'UPI बिक्री', creditSales: 'उधार बिक्री', collectionsToday: 'आज की वसूली', grossProfit: 'सकल लाभ', monthlySales: 'मासिक बिक्री', monthlyProfit: 'मासिक लाभ', customerOutstanding: 'ग्राहक बकाया', supplierOutstanding: 'आपूर्तिकर्ता बकाया', inventoryValue: 'स्टॉक मूल्य', lowStock: 'कम स्टॉक', expiring: 'जल्द समाप्त', expensesToday: 'आज का खर्च',
    createSale: 'बिक्री करें', newPurchase: 'नई खरीद', addProduct: 'उत्पाद जोड़ें', addCustomer: 'ग्राहक जोड़ें', viewAll: 'सभी देखें', search: 'खोजें', noRecords: 'अभी कोई रिकॉर्ड नहीं', noRecordsHint: 'व्यवसाय डेटा जोड़ने के बाद रिकॉर्ड यहां दिखाई देंगे.',
  },
} as const
export type Language = keyof typeof dictionary
