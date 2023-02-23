import DePayWidgets from '../../../src'
import fetchMock from 'fetch-mock'
import React from 'react'
import ReactDOM from 'react-dom'
import { CONSTANTS } from '@depay/web3-constants'
import { ethers } from 'ethers'
import { find } from '@depay/web3-exchanges'
import { mock, resetMocks } from '@depay/web3-mock'
import { getProvider, resetCache } from '@depay/web3-client'
import { Token } from '@depay/web3-tokens'

describe('Payment Widget: insufficient balance', () => {

  const blockchain = 'ethereum'
  const accounts = ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045']
  const fromAddress = accounts[0]
  const toAddress = '0x4e260bB2b25EC6F3A59B478fCDe5eD5B8D783B02'
  const TOKEN = '0xa0bEd124a09ac2Bd941b10349d8d224fe3c955eb'
  const exchange = find(blockchain, 'uniswap_v2')
  const amount = 20
  const decimals = 18
  const amountBN = ethers.utils.parseUnits(amount.toString(), decimals)
  const defaultArguments = {
    currency: 'USD',
    accept: [{
      blockchain,
      amount,
      token: TOKEN,
      receiver: toAddress
    }]
  }

  let USDValueMock
  let TOKENRouteMock
  let provider

  beforeEach(async()=>{
    resetMocks()
    resetCache()
    fetchMock.restore()
    mock({ blockchain, accounts: { return: accounts }, wallet: 'metamask' })
    provider = await getProvider(blockchain)

    mock(blockchain)
    mock({ provider, blockchain, request: { to: TOKEN, api: Token[blockchain].DEFAULT } })
    mock({ provider, blockchain, request: { to: CONSTANTS[blockchain].USD, api: Token[blockchain].DEFAULT } })
    mock({ provider, blockchain, request: { to: TOKEN, api: Token[blockchain].DEFAULT, method: 'decimals', return: decimals } })
    mock({ provider, blockchain, request: { to: CONSTANTS[blockchain].USD, api: Token[blockchain].DEFAULT, method: 'decimals', return: decimals } })
    mock({ provider, blockchain, balance: { for: fromAddress, return: ethers.BigNumber.from('0') }})
    mock({ provider, blockchain, request: { to: exchange.factory.address, api: exchange.factory.api, method: 'getPair', params: [TOKEN, CONSTANTS[blockchain].USD], return: CONSTANTS[blockchain].ZERO }})
    mock({ provider, blockchain, request: { to: exchange.factory.address, api: exchange.factory.api, method: 'getPair', params: [TOKEN, CONSTANTS[blockchain].WRAPPED], return: '0xEF8cD6Cb5c841A4f02986e8A8ab3cC545d1B8B6d'}})
    mock({ provider, blockchain, request: { to: exchange.factory.address, api: exchange.factory.api, method: 'getPair', params: [CONSTANTS[blockchain].WRAPPED, TOKEN], return: '0xEF8cD6Cb5c841A4f02986e8A8ab3cC545d1B8B6d'}})
    mock({ provider, blockchain, request: { to: '0xEF8cD6Cb5c841A4f02986e8A8ab3cC545d1B8B6d', api: exchange.pair.api, method: 'getReserves', return: [ethers.utils.parseUnits('1000', 18), ethers.utils.parseUnits('1000', 18), '1629804922'] }})
    mock({ provider, blockchain, request: { to: '0xEF8cD6Cb5c841A4f02986e8A8ab3cC545d1B8B6d', api: exchange.pair.api, method: 'token0', return: TOKEN }})
    mock({ provider, blockchain, request: { to: '0xEF8cD6Cb5c841A4f02986e8A8ab3cC545d1B8B6d', api: exchange.pair.api, method: 'token1', return: CONSTANTS[blockchain].WRAPPED }})
    mock({ provider, blockchain, request: { to: exchange.factory.address, api: exchange.factory.api, method: 'getPair', params: [CONSTANTS[blockchain].USD, CONSTANTS[blockchain].WRAPPED], return: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11'}})
    mock({ provider, blockchain, request: { to: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11', api: exchange.pair.api, method: 'getReserves', return: [ethers.utils.parseUnits('1000', 18), ethers.utils.parseUnits('1000', 18), '1629804922'] }})
    mock({ provider, blockchain, request: { to: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11', api: exchange.pair.api, method: 'token0', return: CONSTANTS[blockchain].USD }})
    mock({ provider, blockchain, request: { to: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11', api: exchange.pair.api, method: 'token1', return: CONSTANTS[blockchain].WRAPPED }})
    USDValueMock = mock({provider, blockchain, "call":{"to":"0x7a250d5630b4cf539739df2c5dacb4c659f2488d","api":exchange.router.api,"method":"getAmountsOut","return":"Your Value","params":["20000000000000000000",["0xa0bed124a09ac2bd941b10349d8d224fe3c955eb","0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2","0x6b175474e89094c44da98b954eedeac495271d0f"]]}})
    TOKENRouteMock = mock({provider, blockchain, "call":{"to":"0x7a250d5630b4cf539739df2c5dacb4c659f2488d","api":exchange.router.api,"method":"getAmountsIn","return":"Your Value","params":["20000000000000000000",["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2","0xa0bed124a09ac2bd941b10349d8d224fe3c955eb"]]}})
    
    fetchMock.get({
      url: `https://public.depay.com/accounts/${blockchain}/${fromAddress}/assets`,
      overwriteRoutes: true
    }, [])

    fetchMock.get({
      url: `https://public.depay.com/currencies/USD`,
      overwriteRoutes: true
    }, "0.85")
  })

  it('shows a dialog explaining that no payment route could be found', () => {
    cy.visit('cypress/test.html').then((contentWindow) => {
      cy.document().then((document)=>{
        DePayWidgets.Payment({ ...defaultArguments, document })
        cy.get('.ReactShadowDOMOutsideContainer').shadow().find('.Card').contains('Detected').click()
        cy.get('.ReactShadowDOMOutsideContainer').shadow().contains('strong', 'We were not able to find any asset with enough value in your wallet. Please top up your account in order to proceed with this payment.')
      })
    })
  })

  it('stops reloading routes and toToken price', () => {
    let USDValueMock_count
    let TOKENRouteMock_count
    cy.visit('cypress/test.html').then((contentWindow) => {
      cy.document().then((document)=>{
        DePayWidgets.Payment({ ...defaultArguments, document })
        cy.get('.ReactShadowDOMOutsideContainer').shadow().find('.Card').contains('Detected').click()
        cy.get('.ReactShadowDOMOutsideContainer').shadow().contains('strong', 'We were not able to find any asset with enough value in your wallet. Please top up your account in order to proceed with this payment.')
        cy.wait(2000).then(()=>{
          USDValueMock_count = USDValueMock.calls.count()
          TOKENRouteMock_count = TOKENRouteMock.calls.count()
        })
        cy.wait(16000).then(()=>{
          expect(USDValueMock.calls.count()).to.eq(USDValueMock_count)
          expect(TOKENRouteMock.calls.count()).to.eq(TOKENRouteMock_count)
        })
      })
    })
  })
})
