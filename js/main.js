"use strict";
let g_data;
let g_connection;
let g_vineyard_editor;
let g_wine_editor;
function winelist_main() {
    g_data = new DataStore();
    g_connection = new Connection(g_data);
    let ui = new WinelistUI(g_data);
    g_vineyard_editor = new VineyardEditor(g_data);
    g_wine_editor = new WineEditor(g_data);
    g_data.initializeFromDatabase()
        .then(() => {
        g_connection.checkPrefix();
        ui.create();
        g_connection.start();
    })
        .then(() => {
    });
}
//# sourceMappingURL=main.js.map