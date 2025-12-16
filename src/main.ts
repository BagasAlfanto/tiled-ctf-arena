/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra } from "@workadventure/scripting-api-extra";

console.log("Script started successfully");

let currentPopup: any = undefined;

// --- FUNGSI UPDATE VISUAL ---
function updateDoorVisuals(isOpen: boolean) {
  if (isOpen) {
    WA.room.hideLayer("DoorClosed");
    WA.room.showLayer("DoorOpen");
  } else {
    WA.room.showLayer("DoorClosed");
    WA.room.hideLayer("DoorOpen");
  }
}

// --- LOGIKA UTAMA ---
WA.onInit()
  .then(() => {
    console.log("Scripting API ready");

    const isUnlocked = WA.state.loadVariable("room_door_unlocked") as boolean;
    updateDoorVisuals(isUnlocked === true);

    WA.room.area.onEnter("zone_password").subscribe(() => {
      const currentStatus = WA.state.loadVariable(
        "room_door_unlocked"
      ) as boolean;

      if (currentStatus) {
        // Hapus argument kedua 'System' jika error juga muncul di sini
        WA.chat.sendChatMessage("Pintu sudah terbuka.");
        return;
      }

      // --- PERBAIKAN DI SINI ---
      // Kita gunakan @ts-ignore untuk melewati error "Expected 1 arguments"
      // karena kita BUTUH 'allowApi: true' agar password berfungsi.

      // @ts-ignore
      currentPopup = WA.ui.website.open("password.html", {
        position: {
          vertical: "middle",
          horizontal: "middle",
        },
        size: {
          width: "400px",
          height: "300px",
        },
        allowApi: true,
      });
    });

    WA.room.area.onLeave("zone_password").subscribe(() => {
      if (currentPopup) {
        currentPopup.close();
        currentPopup = undefined;
      }
    });

    WA.state.onVariableChange("room_door_unlocked").subscribe((value) => {
      updateDoorVisuals(value === true);

      if (value === true) {
        if (currentPopup) {
          currentPopup.close();
          currentPopup = undefined;
        }
        // Hapus 'System' agar lebih aman dari error tipe
        WA.chat.sendChatMessage("Password Diterima. Pintu Terbuka!");
      }
    });

    bootstrapExtra()
      .then(() => {
        console.log("Scripting API Extra ready");
      })
      .catch((e) => console.error(e));
  })
  .catch((e) => console.error(e));

export {};
