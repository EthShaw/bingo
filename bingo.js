/**
 * Copyright (c) 2020 FishDog5000
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { base64ToBytes, bytesToBase64 } from './thirdparty/base64-typedarrays.js';

var table = document.createElement('table');

var rng;
var cardID;
var seed;

function loadCardData() {
    var params = new URLSearchParams(window.location.search);
    cardID = params.get('s');

    if (cardID) {
        try {
            cardID = cardID.replace(/-/g, '+').replace(/_/g, '/');
            
            // We remove the = padding (if present) when creating the base64 cardID,
            // so we have to re-add it here for the base64 to be valid. Basically,
            // the string length for base64 has to be a multiple of four, and
            // equals signs are used as padding to ensure this.
            var base64Str = cardID.padEnd(Math.ceil(cardID.length / 4) * 4, '=');
            var bytes = base64ToBytes(base64Str);
            seed = bytes;
            rng = new Random();
            rng.setSeedAsUint8Array(bytes);
        } catch (err) {
            console.error(err);
            // Seed is invalid, so rng will not be set, and the if statement below will run
        }
    }

    if (!rng) {
        makeCard();
    }
    window.rng = rng;
}

function getCardData() {
    // Replacing + and / with - and _ makes the cardID URL-safe
    return cardID.replace(/\+/g, '-').replace(/\//g, '_');
}

function makeCard() {
    rng = new Random();
    seed = rng.getSeedAsUint8Array();
    // Removes the trailing equals signs (if there are any). See comment
    // above when loading the cardID from URL parameters about base64.
    cardID = bytesToBase64(seed).replace(/=+$/g, '');
}

loadCardData();

var freeSpace = true;

var bingoState = [
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false]
];

var BingoData = {};
BingoData[cardID] = {
    'timestamp': Date.now(),
    'state': bingoState
};

loadStorage();
generateBingo();

function saveStorage() {
    BingoData[cardID] = {
        'timestamp': Date.now(),
        'state': bingoState
    };
    localStorage.setItem('BingoData', JSON.stringify(BingoData));
}

function loadStorage() {
    var json = localStorage.getItem('BingoData');

    if (json) {
        try {
            var data = JSON.parse(json);

            // The following code deletes entries that are older than 30 days
            var keysToDelete = [];

            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    // !(condition) means that if timestamp is undefined,
                    // condition will be false, making !(condition), causing
                    // the entry to be thrown out.
                    if (!(data[key].timestamp > Date.now() - 1000 * 60 * 60 * 24 * 30)) {
                        keysToDelete.push(key);
                    }
                }
            }

            for (var i = 0; i < keysToDelete.length; i++) {
                delete data[keysToDelete[i]];
            }

            BingoData = data;

            var dataForCard = data[cardID];

            if (dataForCard && dataForCard.state) {
                var state = dataForCard.state;

                if (!Array.isArray(state) || state.length !== 5) {
                    throw 'Row count is not 5!';
                }

                for (var row = 0; row < 5; row++) {
                    if (!Array.isArray(state[row]) || state[row].length !== 5) {
                        throw 'Column count for row ' + row + ' is not 5!';
                    }
                }

                bingoState = state;
            }
        } catch (err) {
            console.log('There was an error loading the current layout, clearing it!');
            console.error(err);
            saveStorage();
        }
    }
}

function generateBingo() {
    var ranges = [
        { min: 1, max: 15 },
        { min: 16, max: 30 },
        { min: 31, max: 45 },
        { min: 46, max: 60 },
        { min: 61, max: 75 }
    ];

    var bingo = [[], [], [], [], []];

    for (var col = 0; col < 5; col++) {
        for (var row = 0; row < 5; row++) {
            var r = ranges[col];
            var rand;
            do {
                rand = r.min + Math.floor(rng.nextDouble() * (r.max - r.min + 1));
            } while (bingo[col].includes(rand));

            bingo[col][row] = rand;
        }
    }
    if (freeSpace) {
        bingo[2][2] = 'FREE SPACE';
    }

    var header = document.createElement('tr');
    var headers = 'BINGO'.split('');

    for (var i = 0; i < 5; i++) {
        var h = document.createElement('th');
        h.innerText = headers[i];
        header.appendChild(h);
    }

    table.append(header);

    for (var row = 0; row < 5; row++) {
        var rowElem = document.createElement('tr');
        for (var col = 0; col < 5; col++) {
            var cell = document.createElement('td');
            cell.innerText = bingo[col][row];

            rowElem.appendChild(cell);

            cell.dataset.row = row;
            cell.dataset.col = col;

            if (bingoState[row][col]) {
                cell.classList.add('selected');
            }

            cell.onclick = function() {
                var r = this.dataset.row;
                var c = this.dataset.col;

                bingoState[r][c] = !bingoState[r][c];
                saveStorage();

                if (bingoState[r][c]) {
                    this.classList.add('selected');
                } else {
                    this.classList.remove('selected');
                }
            }
        }
        table.append(rowElem);
    }

    document.body.appendChild(table);
    window.bingo = bingo;
}
