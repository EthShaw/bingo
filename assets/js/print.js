/**
 * Copyright (c) 2020 Ethan Shaw
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
'use strict';

var divPrintBlock = document.getElementById('printBlock');
var divPrintControls = document.getElementById('printControls');
var card = Card.loadFromURL();
var cards;

if (card == null) {
    let params = new URLSearchParams(window.location.search.substring(1));

    let cardSetIdx = params.get('l');

    let manager = new CardManager();

    sets = manager.getAllSets();

    set = sets[cardSetIdx];

    if (!set) {
        // The URL parameter must be invalid, so redirect to the generator
        // TODO have some kind of message so they know what's going on
        window.location.href = document.getElementById('makerLoc').href;
    }

    cards = set.cards.map(function (x) { new Card(x) });
} else {
    cards = [card];
}

// Get the CSS
let sheets = document.styleSheets;
let css = '';

for (let sheet of sheets) {
    for (let rule of sheet.cssRules) {
        css += rule.cssText + '\n';
    }
}

var rotate = false;

// Make the SVG for all the cards
for (let card of cards) {
    let divCard = document.createElement('div');
    divPrintBlock.appendChild(divCard);

    card.bindToDiv(divCard, false);

    let height = 5.5;
    // The height is about 1.17 times the width, so dividing by 1.15 adds some extra padding
    let width = height / 1.15;
    divCard.style.width = width + 'in';
    divCard.style.height = height + 'in';

    card.updateSize();

    let elemStyle = document.createElement('style');
    elemStyle.textContent = css;

    divCard.appendChild(elemStyle);

    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    // The card must be on the document for it to have a width and height, which
    // is used below.
    divPrintBlock.appendChild(svg);


    let foreignObj = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    svg.appendChild(foreignObj);
    foreignObj.appendChild(divCard);

    if (rotate) {
        svg.setAttributeNS(null, 'width', divCard.offsetHeight);
        svg.setAttributeNS(null, 'height', divCard.offsetWidth);
        svg.setAttributeNS(null, 'viewBox', '0 0 ' + divCard.offsetHeight + ' ' + divCard.offsetWidth);
        foreignObj.setAttributeNS(null, 'transform', 'rotate(90) translate(0 ' + -divCard.offsetHeight + ')');
    } else {
        svg.setAttributeNS(null, 'width', divCard.offsetWidth);
        svg.setAttributeNS(null, 'height', divCard.offsetHeight);
        svg.setAttributeNS(null, 'viewBox', '0 0 ' + divCard.offsetWidth + ' ' + divCard.offsetHeight);
    }

    foreignObj.setAttributeNS(null, 'x', 0);
    foreignObj.setAttributeNS(null, 'y', 0);
    foreignObj.setAttributeNS(null, 'width', divCard.offsetWidth);
    foreignObj.setAttributeNS(null, 'height', divCard.offsetHeight);

    // Serialize the svg to XML, convert to base64, and turn into a data URI for an <img> tag
    let xmlStr = new XMLSerializer().serializeToString(svg);
    let svgB64 = btoa(xmlStr);

    let image = new Image();
    image.src = 'data:image/svg+xml;base64,' + svgB64;
    image.classList.add('bingo-card-img');
    divPrintBlock.appendChild(image);

    // Delete the SVG from the document
    divPrintBlock.removeChild(svg);
}

// Thanks to inspiration from this StackOverflow question:
// https://stackoverflow.com/questions/54535222/convert-svg-element-to-img
