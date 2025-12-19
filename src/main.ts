/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra } from "@workadventure/scripting-api-extra";
import {ActionMessage} from "@workadventure/iframe-api-typings";

const DOOR_PASSWORD = "TestPassword123";
const AUTO_CLOSE_DELAY_MS = 8000;

let autoCloseHandle: number | undefined;
let insideDoorstepActive = false;
let outsideDoorstepActive = false;
let insideMessage: ActionMessage | undefined;
let outsideMessage: ActionMessage | undefined;
let passwordModalOpen = false;
let resolvePasswordModal: ((result: boolean) => void) | undefined;

console.log('Script started successfully');

// Waiting for the API to be ready
WA.onInit().then(async () => {
    console.log('Scripting API ready');

    // The line below bootstraps the Scripting API Extra library that adds a number of advanced properties/features to WorkAdventure
    bootstrapExtra().then(() => {
        console.log('Scripting API Extra ready');
    }).catch(e => console.error(e));

    await WA.players.configureTracking({
        players: true,
        movement: false,
    });

    // The doorState variable contains the state of the door.
    // True: the door is open
    // False: the door is closed
    // We listen to variable change to display the correct door image.
    WA.state.onVariableChange('doorState').subscribe((doorState) => {
        displayDoor(doorState);
    });

    initializeDoorState();

    // When someone walks on the doorstep (inside the room), display a message and enable E-key trigger
    WA.room.onEnterLayer('doorsteps/inside_doorstep').subscribe(() => {
        insideDoorstepActive = true;
        insideMessage = WA.ui.displayActionMessage({
            message: "Masukkan password untuk membuka pintu",
            callback: () => { void triggerDoorInteraction(); }
        });

        void triggerDoorInteraction();
    });

    // When someone leaves the doorstep (inside the room), we remove the message
    WA.room.onLeaveLayer('doorsteps/inside_doorstep').subscribe(() => {
        insideDoorstepActive = false;
        if (insideMessage !== undefined) {
            insideMessage.remove();
            insideMessage = undefined;
        }
    });

    WA.room.onEnterLayer('meetingRoom').subscribe(() => {
        WA.player.state.saveVariable("currentRoom", "meetingRoom", {
            public: true,
            persist: false
        });
    });

    WA.room.onLeaveLayer('meetingRoom').subscribe(() => {
        WA.player.state.saveVariable("currentRoom", undefined, {
            public: true,
            persist: false
        });
    });

    // When someone walks on the doorstep (outside the room), show E-key hint and require password to open
    WA.room.onEnterLayer('doorsteps/outside_doorstep').subscribe(() => {
        outsideDoorstepActive = true;
        outsideMessage = WA.ui.displayActionMessage({
            message: "Masukkan password untuk membuka pintu",
            callback: () => { void triggerDoorInteraction(); }
        });

        void triggerDoorInteraction();
    });

    WA.room.onLeaveLayer('doorsteps/outside_doorstep').subscribe(() => {
        outsideDoorstepActive = false;
        if (outsideMessage !== undefined) {
            outsideMessage.remove();
            outsideMessage = undefined;
        }
    });

}).catch(e => console.error(e));

async function triggerDoorInteraction() {
    if (!insideDoorstepActive && !outsideDoorstepActive) {
        return;
    }

    if (passwordModalOpen) {
        return; // already open
    }

    if (WA.state.doorState === true) {
        return; // already open, do nothing
    }

    const ok = await openPasswordModal();
    if (ok) {
        openDoor();
    }
}

/**
 * Display the correct door image depending on the state of the door.
 */
function displayDoor(state: unknown) {
    if (state === true) {
        WA.room.showLayer('door/door_opened');
        WA.room.hideLayer('door/door_closed');
    } else {
        WA.room.hideLayer('door/door_opened');
        WA.room.showLayer('door/door_closed');
    }
}

async function openPasswordModal(): Promise<boolean> {
    if (passwordModalOpen) {
        // Modal already open; reuse pending promise
        return new Promise<boolean>((resolve) => {
            resolvePasswordModal = resolve;
        });
    }

    return new Promise<boolean>(async (resolve) => {
        passwordModalOpen = true;
        resolvePasswordModal = resolve;

        // Determine the correct URL based on hostname
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const protocol = isLocalhost ? 'http:' : window.location.protocol;
        const baseUrl = `${protocol}//${window.location.host}`;
        const passwordUrl = `http://localhost:5173/password.html`;

        console.log('Opening password modal with URL:', passwordUrl);

        // Use WA.ui.website to open the password form
        const website = await WA.ui.website.open({
            url: passwordUrl,
            visible: true,
            allowApi: true,
            allowPolicy: "fullscreen",
            position: {
                vertical: "middle",
                horizontal: "middle"
            },
            size: {
                height: "280px",
                width: "350px"
            },
            margin: {
                top: "0px",
                bottom: "0px",
                left: "0px",
                right: "0px"
            }
        });

        // Close modal function
        const closeModal = (result: boolean) => {
            console.log('Closing modal with result:', result);
            submitSubscription.unsubscribe();
            cancelSubscription.unsubscribe();
            website.close();
            passwordModalOpen = false;
            const resolver = resolvePasswordModal;
            resolvePasswordModal = undefined;
            resolver?.(result);
            resolve(result);
        };

        // Listen for password submit event from iframe
        const submitSubscription = WA.event.on("passwordSubmit").subscribe((event) => {
            console.log('Received passwordSubmit event:', event.data);
            const data = event.data as { password: string };
            if (data.password === DOOR_PASSWORD) {
                closeModal(true);
            } else {
                // Send error back to iframe
                WA.event.broadcast("passwordError", { message: 'Password salah. Coba lagi.' });
            }
        });

        // Listen for cancel event from iframe
        const cancelSubscription = WA.event.on("passwordCancel").subscribe(() => {
            console.log('Received passwordCancel event');
            closeModal(false);
        });
    });
}

function initializeDoorState() {
    // Pastikan pintu tertutup saat awal
    WA.state.doorState = false;
    displayDoor(false);
}

function openDoor() {
    WA.state.doorState = true;
    startAutoCloseTimer();
}

function closeDoor() {
    WA.state.doorState = false;
    clearAutoCloseTimer();
}

function startAutoCloseTimer() {
    clearAutoCloseTimer();
    autoCloseHandle = window.setTimeout(() => {
        closeDoor();
    }, AUTO_CLOSE_DELAY_MS);
}

function clearAutoCloseTimer() {
    if (autoCloseHandle !== undefined) {
        clearTimeout(autoCloseHandle);
        autoCloseHandle = undefined;
    }
}

export {};
