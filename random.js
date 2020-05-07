// LCG
var Random = (function() {
    const MULTIPLIER_LO = 0xDEECE66D;
    const MULTIPLIER_HI = 0x5;
    const ADDIN = 0xB;

    function Random(seed) {
        if (!(seed instanceof Uint32Array) || seed.length !== 2) {
            seed = new Uint32Array([new Date().getTime(), new Date().getTime()]);
        }
        this.setSeed(seed);
    }

    Random.prototype.next = function() {
        // Multiply two 32 bit numbers and round off at 32 bits
        function mult32(op1, op2) {
            var hi, lo;

            var u1, v1, t, w3, k, w1;

            u1 = (op1 & 0xFFFF);
            v1 = (op2 & 0xFFFF);
            t = (u1 * v1);
            w3 = (t & 0xFFFF);
            k = (t >>> 16);

            op1 >>>= 16;
            t = (op1 * v1) + k;
            k = (t & 0xFFFF);
            w1 = (t >>> 16);

            op2 >>>= 16;
            t = (u1 * op2) + k;
            k = (t >>> 16);

            hi = (op1 * op2) + w1 + k;

            // Note: the >>> 0 is required to make sure t is unsigned
            lo = ((t << 16) >>> 0) + w3;

            return {
                lo: lo,
                hi: hi
            };
        }

        // Multiplies everything properly
        var mult0 = mult32(this.seed[0], MULTIPLIER_LO);
        var mult1 = mult32(this.seed[0], MULTIPLIER_HI);
        this.seed[0] = mult0.lo;
        mult2 = mult32(this.seed[1], MULTIPLIER_LO);
        this.seed[1] = mult0.hi + mult1.lo + mult2.lo;

        // And add ADDIN
        this.seed[0] += ADDIN;
        if (this.seed[0] < ADDIN) {
            this.seed[1]++;
        }

        return this.seed;
    };

    Random.prototype.setSeed = function(seed) {
        seed[0] ^= MULTIPLIER_LO;
        seed[1] ^= MULTIPLIER_HI;
        this.seed = seed;
    };

    Random.prototype.getSeed = function() {
        var ret = new Uint32Array(2);
        ret[0] = this.seed[0] ^ MULTIPLIER_LO;
        ret[1] = this.seed[1] ^ MULTIPLIER_HI;
        return ret;
    };

    // This returns the seed as a Uint8Array in little-endian order
    Random.prototype.getSeedAsUint8Array = function() {
        var seed = this.getSeed();
        var ret = new Uint8Array(8);

        for (var i = 0; i < 2; i++) {
            for (var j = 0; j < 4; j++) {
                ret[i * 4 + j] = (seed[i] >>> (8 * j)) & 0xFF;
            }
        }

        return ret;
    }

    // This sets the seed from a Uint8Array in little-endian order
    Random.prototype.setSeedAsUint8Array = function(seedIn) {
        var seedOut = new Uint32Array(2);

        for (var i = 0; i < 2; i++) {
            for (var j = 0; j < 4; j++) {
                seedOut[i] |= seedIn[i * 4 + j] << (8 * j)
            }
        }

        this.setSeed(seedOut);
    }

    Random.prototype.nextInt = function() {
        // << 0 makes it signed again
        return this.next()[1] << 0;
    };

    Random.prototype.nextDouble = function() {
        return (((this.next()[1] >>> (32 - 26)) * Math.pow(2, 27)) + (this.next()[1] >>> (32 - 27))) * (1.0 / (1.0 * Math.pow(2, 53)));
    };

    return Random;
})();