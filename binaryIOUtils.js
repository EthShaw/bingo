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

// These helper functions to read and write stuff in Uint8Arrays at specific
// offsets

// Writes a uint32 array with each integer in little-endian order into `array`
// starting at `offset`
function writeUint32Array(nums, array, offset) {
    offset = offset || 0;

    for (var i = 0; i < nums.length; i++) {
        for (var j = 0; j < 4; j++) {
            array[i * 4 + j + offset] = (nums[i] >>> (8 * j)) & 0xFF;
        }
    }
}

// Writes a uint32 in little-endian order to `array` at `offset`
function writeUint32(num, array, offset) {
    writeUint32Array([num], array, offset);
}

// Writes a uint16 in little-endian order to `array` at `offset`
function writeUint16(num, array, offset) {
    array[offset] = num & 0xFF;
    array[offset + 1] = (num >>> 8) & 0xFF;
}

// Reads a Uint32Array with length `length` starting at offset `offset` from
// Uint8Array `array`, where each uint32 is in little-endian order
function readUint32Array(array, offset, length) {
    var ret = new Uint32Array(length);

    for (var i = 0; i < length; i++) {
        for (var j = 0; j < 4; j++) {
            ret[i] |= array[i * 4 + j + offset] << (8 * j)
        }
    }

    return ret;
}

// Reads a uint32 in little-endian order from Uint8Array `array` at `offset`
function readUint32(array, offset) {
    var array = readUint32Array(array, offset, 1);
    
    return array[0];
}

// Reads a uint16 in little-endian order from Uint8Array `array` at `offset`
function readUint16(array, offset) {
    var num = array[offset];
    num |= array[offset + 1] << 8;

    return num;
}
