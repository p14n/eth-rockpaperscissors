var RockPaperScissors =  artifacts.require("./RockPaperScissors.sol");
var expectedExceptionPromise = require('./expected_exception_testRPC_and_geth');
var BigNumber = require('bignumber.js');
var utils = require('web3-utils');

contract('RockPaperScissors', function ([alice,bob,carol]) {

    let rps,rockVal,scissorsVal,paperVal;
    const gameAmount = 500000000;
    const maxGas = 500000;
    const minWinnings = new BigNumber(gameAmount).minus(maxGas);

    beforeEach('setup contract for each test', async () => {
        rps = await RockPaperScissors.new({ from: alice })
        rockVal = await rps.ROCK();
        paperVal = await rps.PAPER();
        scissorsVal = await rps.SCISSORS();
    })

    it('should assert rock beats scissors', async () => {
        assert.isTrue(await rps.firstWins(rockVal,scissorsVal))
    })
    it('should assert paper beats rock', async () => {
        assert.isTrue(await rps.firstWins(paperVal,rockVal))
    })
    it('should assert scissors beat paper', async () => {
        assert.isTrue(await rps.firstWins(scissorsVal,paperVal))
    })
    it('should assert paper does not beat scissors', async () => {
        assert.isFalse(await rps.firstWins(paperVal,scissorsVal))
    })
    it('should assert rock does not beat paper', async () => {
        assert.isFalse(await rps.firstWins(rockVal,paperVal))
    })

    it('should allow winner to claim funds', async () => {

        const balance = await web3.eth.getBalance(bob);
        const proof1 = await utils.soliditySha3(rockVal,"pwd1");
        const proof2 = await utils.soliditySha3(scissorsVal,"pwd2");

        const tx = await rps.createGame(proof1,{ from:bob,value:gameAmount});
        const gameId = fromLog(tx,"GameCreated","gameId").toNumber()
        await rps.playGame(gameId,proof2,{ from:carol,value:gameAmount});

        const tx2 = await rps.reveal(gameId,rockVal,"pwd1",{from:bob});
        await rps.reveal(gameId,scissorsVal,"pwd2",{from:carol});
        const tx3 = await rps.requestFunds(gameId,{from:bob});
        const balance2 = await web3.eth.getBalance(bob);
        const diff = balance2.minus(balance);
        const gas = await gasCost(tx,tx2,tx3);
        assert(balance.plus(gameAmount).minus(gas).eq(balance2));

    })
    it('should not allow the loser to claim funds', async () => {

        const balance = await web3.eth.getBalance(carol);
        const proof1 = await utils.soliditySha3(rockVal,"pwd1");
        const proof2 = await utils.soliditySha3(scissorsVal,"pwd2");

        const tx = await rps.createGame(proof1,{ from:bob,value:gameAmount});
        const gameId = fromLog(tx,"GameCreated","gameId").toNumber()
        await rps.playGame(gameId,proof2,{ from:carol,value:gameAmount});
        await rps.reveal(gameId,rockVal,"pwd1",{from:bob});
        await rps.reveal(gameId,scissorsVal,"pwd2",{from:carol});
        await expectedExceptionPromise( () => rps.requestFunds(gameId,{from:carol}));

    })
    it('should prevent playing after refund', async () => {

        //const balance = await web3.eth.getBalance(carol);
        const proof1 = await utils.soliditySha3(rockVal,"pwd1");
        const proof2 = await utils.soliditySha3(scissorsVal,"pwd2");

        const tx = await rps.createGame(proof1,{ from:bob,value:gameAmount});
        const gameId = fromLog(tx,"GameCreated","gameId").toNumber()
        await rps.requestCancel(gameId,{ from:bob });
        await rps.requestFunds(gameId,{from:bob});
        await expectedExceptionPromise( () => rps.playGame(gameId,proof2,{ from:carol,value:gameAmount}));

    })

    it('should prevent refund after play', async () => {

        const balance = await web3.eth.getBalance(carol);
        const proof1 = await utils.soliditySha3(rockVal,"pwd1");
        const proof2 = await utils.soliditySha3(scissorsVal,"pwd2");

        const tx = await rps.createGame(proof1,{ from:bob,value:gameAmount});
        const gameId = fromLog(tx,"GameCreated","gameId").toNumber()
        
        await rps.playGame(gameId,proof2,{ from:carol,value:gameAmount});
        await expectedExceptionPromise( () => rps.requestCancel(gameId,{ from:bob }));

    })


    const gasCost = async(...txs) => {
        let total = new BigNumber(0);
        for (var i = 0; i < txs.length; i++) {
           let tx = txs[i];
           let cost = await web3.eth.getTransaction(tx.tx)
                   .gasPrice.times(tx.receipt.gasUsed);
            total = total.plus(cost);
        }
        return total;
   }


    const fromLog = (tx,event,name) => {
        for (var i = 0; i < tx.logs.length; i++) {
            var log = tx.logs[i];
            if (log.event == event) {
                return log.args[name];
            }
        }
    }

})
