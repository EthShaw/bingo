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

window.addEventListener('DOMContentLoaded', function() {
    const BINGO_URL = document.getElementById('cardLoc');
    let manager = new CardManager();

    class CardSetElem {
        constructor(set, elemParent) {
            this.elemParent = elemParent;
            this.cardSet = set;

            let divElem = document.createElement('div');
            divElem.classList.add('bingo-card-set')

            let spanName = document.createElement('span');
            let btnRename = document.createElement('button');
            let spanCardCount = document.createElement('span');
            let spanHasFreeSpace = document.createElement('span');
            let btnStartGame = document.createElement('button');
            let spanCards = document.createElement('span');
            let btnViewCards = document.createElement('button');
            let ulCardList = document.createElement('ul');
            let btnDelete = document.createElement('button');

            spanName.innerText = 'Name: ' + set.name;
            spanCardCount.innerText = 'Number of card: ' + set.cards.length;
            spanHasFreeSpace.innerText = set.freeSpace ? 'Has free spaces.' : 'Doesn\'t have free spaces.';

            ulCardList.hidden = true;;
            let cSElem = this;

            btnRename.innerText = 'Rename';
            btnRename.addEventListener('click', function() {
                // TODO don't use JavaScript popups for this
                let newName = prompt('What would you like to name the card set?', set.name);

                // Name didn't change, so do nothing (null means that the user
                // pressed cancel)
                if (newName === set.name || newName === null) {
                    return;
                }

                let validity = getNameValidity(newName);
                if (validity === 1) {
                    set.name = newName;
                    spanName.innerText = 'Name: ' + set.name;
                    manager.saveStorage();
                } else {
                    if (validity === 0) {
                        alert('New name cannot be empty');
                    } else {
                        alert('Name "' + newName + '" is already taken!');
                    }
                }
            });

            btnStartGame.innerText = 'Start Game';
            btnStartGame.addEventListener('click', function() {
                startGame(set);
            });

            btnViewCards.innerText = 'View Cards';
            btnViewCards.addEventListener('click', function() {
                if (!cSElem.populated) {
                    btnViewCards.innerText = 'Hide Cards';
                    let docFrag = document.createDocumentFragment();

                    set.cards.forEach(function(id) {
                        let card = new Card(id);

                        let urlStr = BINGO_URL + '?s=' + id;
                        let aUrl = document.createElement('a');
                        let liCard = document.createElement('li');
                        let textCardNum = document.createTextNode('Card ' + card.cardNumber.toString().padStart(3, '0') + ': ');

                        aUrl.href = urlStr;
                        aUrl.innerText = urlStr;

                        liCard.appendChild(textCardNum);
                        liCard.appendChild(aUrl);

                        docFrag.appendChild(liCard);
                    });

                    ulCardList.appendChild(docFrag);
                    cSElem.populated = true;
                }

                ulCardList.hidden = !ulCardList.hidden;

                if (ulCardList.hidden) {
                    btnViewCards.innerText = 'View Cards';
                } else {
                    btnViewCards.innerText = 'Hide Cards';
                }
            });

            btnDelete.innerText = 'Delete Set';
            btnDelete.addEventListener('click', function() {
                // TODO don't use window.confirm, use a custom html approach
                let sure = window.confirm('Are you sure you want to delete the set named "' + set.name + '"?');

                if (sure) {
                    if (!manager.deleteSet(set)) {
                        console.error('Set was not actually deleted: ' + set.name);
                    }
                    cSElem.destroy();
                }
            });

            spanName.appendChild(btnRename);
            spanCards.appendChild(btnViewCards);
            spanCards.appendChild(ulCardList);

            spanName.classList.add('bingo-card-set-child');
            spanCardCount.classList.add('bingo-card-set-child');
            spanHasFreeSpace.classList.add('bingo-card-set-child');
            btnStartGame.classList.add('bingo-card-set-child');
            spanCards.classList.add('bingo-card-set-child');
            btnDelete.classList.add('bingo-card-set-child');

            divElem.appendChild(spanName);
            divElem.appendChild(spanCardCount);
            divElem.appendChild(spanHasFreeSpace);
            divElem.appendChild(btnStartGame);
            divElem.appendChild(spanCards);
            divElem.appendChild(btnDelete);
            elemParent.appendChild(divElem);

            this.elem = divElem;
        }

        destroy() {
            this.elemParent.removeChild(this.elem);
        }
    }

    // Populate the card set list
    let elemList = document.getElementById('divCardSetHolder');

    manager.getAllSets().forEach(function(x) {
        new CardSetElem(x, elemList);
    });

    // Card set creator menu stuff
    let btnCreateSet = document.getElementById('btnCreateSet');
    let textSetName = document.getElementById('textSetName');
    let textNumCards = document.getElementById('textNumCards');
    let checkboxUseFreeSpace = document.getElementById('checkboxUseFreeSpace');
    let pErrMsg = document.getElementById('pErrMsg');

    // Returns 0 for empty, -1 for taken, and 1 for not taken
    function getNameValidity(name) {
        if (!name || name.length === 0) {
            return 0;
        }

        let sets = manager.getAllSets();

        for (let i = 0; i < sets.length; i++) {
            let set = sets[i];

            if (name === set.name) {
                return -1;
            }
        }

        return 1;
    }

    function checkValidName(value) {
        // If this is called as the event handler, value is an object and needs
        // to be ignored (and instead gotten from the textbox AKA this), but
        // otherwise it is the value passed in by the calling function.
        if (typeof (value) !== 'string') {
            value = this.value;
        }

        let validity = getNameValidity(value);

        // If the name is empty, don't display any errors
        if (validity === 0) {
            pErrMsg.hidden = true;
            btnCreateSet.disabled = true;
            return;
        } else if (validity === -1) {
            pErrMsg.innerText = 'Error: A set already exists with that name!';
            pErrMsg.hidden = false;
            btnCreateSet.disabled = true;
            return;
        } else {
            pErrMsg.hidden = true;
            btnCreateSet.disabled = false;
        }
    }

    function makeSetClick() {
        let name = textSetName.value;
        let num = parseInt(textNumCards.value);
        let useFreeSpace = checkboxUseFreeSpace.checked;

        // This should never actually happen because the button should be disabled
        // for invalid set names
        if (getNameValidity(name) !== 1) {
            pErrMsg.innerText = 'Error: set name invalid or already taken!';
            console.log('This should not have happened!');
            pErrMsg.hidden = false;
            return;
        }

        let set = manager.newSet(name, num, useFreeSpace);

        new CardSetElem(set, elemList);

        // Clear the name textbox after creating the set
        textSetName.value = '';
        checkValidName(textSetName.value);
    }

    // Caller stuff
    let caller, boundCard, currentSet;
    let divCaller = document.getElementById('divCaller');
    let btnNextCall = document.getElementById('btnNextCall');
    let btnRestartGame = document.getElementById('btnRestartGame');
    let divCalls = document.getElementById('divCalls');
    let textCallerCardNum = document.getElementById('textCallerCardNum');
    let divCardCheck = document.getElementById('divCardCheck');
    let btnCardCheck = document.getElementById('btnCardCheck');

    divCardCheck.style.width = '300px';
    divCardCheck.style.height = '300px';

    function startGame(set) {
        // Clean up after previous games
        if (caller) {
            let sure = confirm('Are you sure you want to start a new game and end the current one?');

            if (!sure) {
                return;
            }

            divCalls.value = '';

            if (boundCard) {
                // TODO remove the necessity for this try-catch
                // See checkCard function for more info.
                try {
                    let tempCard = boundCard;
                    boundCard = null;
                    caller.unShowCard(divCardCheck, tempCard);
                } catch { }

                while (divCardCheck.firstChild) {
                    divCardCheck.removeChild(divCardCheck.lastChild);
                }
            }
        }

        divCaller.hidden = false;
        currentSet = set;
        caller = new Caller(set);
    }

    function nextCall() {
        let next = caller.nextCall();
        if (next == null) {
            next = 'All numbers have been called!';
        }
        divCalls.value = next + '\n' + divCalls.value;
    }

    function checkCard() {
        let num = parseInt(textCallerCardNum.value);

        if (boundCard) {
            // In case there is an error, null boundCard first so it is gone.
            // This is a temporary workaround that fixes if the user types
            // a card number that is out of range of the cards available.
            // NOT A PERMANENT SOLUTION
            let tempCard = boundCard;
            boundCard = null;
            caller.unShowCard(divCardCheck, tempCard);
        }

        boundCard = num;

        caller.showCard(divCardCheck, num);
    }

    // This makes sure the Create Cards button is disabled when the page first
    // loads with an empty name in the text input.
    checkValidName(textSetName.value);

    btnCreateSet.addEventListener('click', makeSetClick);
    textSetName.addEventListener('input', checkValidName);
    btnNextCall.addEventListener('click', nextCall);
    btnCardCheck.addEventListener('click', checkCard);
    btnRestartGame.addEventListener('click', function() {
        startGame(currentSet);
    });
});
