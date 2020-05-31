window.addEventListener('DOMContentLoaded', function() {
    var manager = new CardManager();
    var selectSet = document.getElementById('selectSet');
    var divNewCards = document.getElementById('divNewCards');
    var divEdit = document.getElementById('divEdit');
    var btnCreateSet = document.getElementById('btnCreateSet');
    var btnRename = document.getElementById('btnRename');
    var btnDelete = document.getElementById('btnDelete');
    var btnStartGame = document.getElementById('btnStartGame');
    var textSetName = document.getElementById('textSetName');
    var textNumCards = document.getElementById('textNumCards');
    var checkboxUseFreeSpace = document.getElementById('checkboxUseFreeSpace');
    var pErrMsg = document.getElementById('pErrMsg');
    var divCardList = document.getElementById('divCardList');
    var BINGO_URL = document.getElementById('cardLoc');

    var caller, boundCard;
    var btnNextCall = document.getElementById('btnNextCall');
    var divCalls = document.getElementById('divCalls');
    var textCallerCardNum = document.getElementById('textCallerCardNum');
    var divCardCheck = document.getElementById('divCardCheck');
    var btnCardCheck = document.getElementById('btnCardCheck');

    divCardCheck.style.width = '300px';
    divCardCheck.style.height = '300px';

    function updateSelectState() {
        // Delete all the old cards from the card list
        while (divCardList.firstChild) {
            divCardList.removeChild(divCardList.lastChild);
        }

        if (selectSet.value === 'new') {
            divEdit.hidden = true;
            btnCreateSet.hidden = false;

            checkboxUseFreeSpace.disabled = false;
            textSetName.disabled = false;
            textNumCards.disabled = false;

            checkboxUseFreeSpace.checked = true;
            textSetName.value = '';
            textNumCards.value = 30;

            // TODO this is very hacky and a very temporary solution that makes the code worse,
            // when the real solution should be to make the code better in the first place.
            checkValidName.apply({ value: '' });
        } else {
            divEdit.hidden = false;
            btnCreateSet.hidden = true;

            checkboxUseFreeSpace.disabled = true;
            textSetName.disabled = true;
            textNumCards.disabled = true;

            var set = manager.getAllSets()[parseInt(selectSet.value)];
            var ids = set.cards;

            checkboxUseFreeSpace.checked = set.freeSpace;
            textSetName.value = set.name;
            textNumCards.value = ids.length;
            pErrMsg.hidden = true;

            // Using a document fragment means a reflow doesn't have to
            // occur with each card added to the list (it's faster)
            let frag = document.createDocumentFragment();

            // Populate the card list
            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];
                var card = new Card(id);

                var str = BINGO_URL + '?s=' + id;
                var a = document.createElement('a');
                var li = document.createElement('li');

                a.href = str;
                a.innerText = str;

                li.appendChild(document.createTextNode('Card ' + card.cardNumber.toString().padStart(3, '0') + ': '));
                li.appendChild(a);
                frag.appendChild(li);
            }

            divCardList.appendChild(frag);
        }
    }

    function checkValidName(event) {
        var name = this.value;

        // If the name is empty, don't display any errors
        if (name.length === 0) {
            pErrMsg.hidden = true;
            btnCreateSet.disabled = true;
            return;
        }

        var sets = manager.getAllSets();

        for (var i = 0; i < sets.length; i++) {
            var set = sets[i];

            if (name === set.name) {
                pErrMsg.innerText = 'Error: A set already exists with that name!';
                pErrMsg.hidden = false;
                btnCreateSet.disabled = true;
                return;
            }
        }

        pErrMsg.hidden = true;
        btnCreateSet.disabled = false;
    }

    function gen() {
        var name = textSetName.value;
        var num = parseInt(textNumCards.value);
        var p = document.getElementById('cards');
        p.innerText = '';
        var ids = [];
        var useFreeSpace = checkboxUseFreeSpace.checked;
        var sets = manager.getAllSets();

        for (var i = 0; i < sets.length; i++) {
            var set = sets[i];

            if (name === set.name) {
                pErrMsg.innerText = 'Error: A set already exists with that name!';
                pErrMsg.hidden = false;
                return;
            }
        }

        var set = manager.newSet(name, num, useFreeSpace);

        var option = document.createElement('option');
        option.value = manager.getAllSets().length - 1;
        option.innerText = sets[i].name;
        selectSet.appendChild(option);

        selectSet.value = option.value;
        updateSelectState.apply(selectSet);
    }

    function deleteSelectedSet() {
        var set = manager.getAllSets()[parseInt(selectSet.value)];
        // TODO don't use window.confirm, use a custom html approach
        var sure = window.confirm("Are you sure you want to delete the set named '" + set.name + "'?");

        if (sure) {
            manager.deleteSetAtIdx(selectSet.value);
            selectSet.remove(selectSet.selectedIndex);

            // TODO we actually have to renumber all the values of all the sets in the select menu if it is not the last set that's deleted
            selectSet.value = 'new';
        }
    }

    function startGame() {
        var set = manager.getAllSets()[parseInt(selectSet.value)];
        divCaller.hidden = false;
        caller = new Caller(set);
    }

    function nextCall() {
        var next = caller.nextCall();
        divCalls.value = next + "\n" + divCalls.value;
        //divCalls.appendChild(document.createTextNode(next));
        //divCalls.appendChild(document.createElement('br'));
    }

    function checkCard() {
        var num = parseInt(textCallerCardNum.value);

        if (boundCard) {
            // In case there is an error, null boundCard first so it is gone.
            // This is a temporary workaround that fixes if the user types
            // a card number that is out of range of the cards available.
            // NOT A PERMANENT SOLUTION
            var tempCard = boundCard;
            boundCard = null;
            caller.unShowCard(divCardCheck, tempCard);
        }

        boundCard = num;

        caller.showCard(divCardCheck, num);
    }

    selectSet.addEventListener('change', updateSelectState);
    btnCreateSet.addEventListener('click', gen);
    textSetName.addEventListener('input', checkValidName);
    btnDelete.addEventListener('click', deleteSelectedSet);
    btnStartGame.addEventListener('click', startGame);
    btnNextCall.addEventListener('click', nextCall);
    btnCardCheck.addEventListener('click', checkCard);

    var sets = manager.getAllSets();

    for (var i = 0; i < sets.length; i++) {
        var option = document.createElement('option');
        option.value = i;
        option.innerText = sets[i].name;
        selectSet.appendChild(option);
    }

    updateSelectState();
});
