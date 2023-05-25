import ClosableContext from '../contexts/ClosableContext'
import ConfigurationContext from '../contexts/ConfigurationContext'
import findMaxRoute from '../helpers/findMaxRoute'
import PaymentBlockchainsDialog from '../dialogs/PaymentBlockchainsDialog'
import PaymentRoutingContext from '../contexts/PaymentRoutingContext'
import React, { useState, useContext, useEffect } from 'react'
import round from '../helpers/round'
import routePayments from '../helpers/routePayments'
import UpdatableContext from '../contexts/UpdatableContext'
import WalletContext from '../contexts/WalletContext'
import WalletMissesBlockchainSupportDialog from '../dialogs/WalletMissesBlockchainSupportDialog'
import { ethers } from 'ethers'
import { ReactDialogStack } from '@depay/react-dialog-stack'
import { request } from '@depay/web3-client'

export default (props)=>{
  const [ allRoutes, setAllRoutes ] = useState()
  const [ updatedRouteWithNewPrice, setUpdatedRouteWithNewPrice ] = useState()
  const [ selectedRoute, setSelectedRoute ] = useState()
  const [ slowRouting, setSlowRouting ] = useState(false)
  const [ reloadCount, setReloadCount ] = useState(0)
  const [ walletMissesBlockchainSupport, setWalletMissesBlockchainSupport ] = useState(false)
  const { wallet, account } = useContext(WalletContext)
  const { updatable } = useContext(UpdatableContext)
  const { recover } = useContext(ConfigurationContext)
  const { open, close } = useContext(ClosableContext)
  
  const onRoutesUpdate = async (routes)=>{
    if(routes.length == 0) {
      setAllRoutes([])
      if(props.setMaxRoute) { props.setMaxRoute(null) }
    } else {
      roundAmounts(routes).then(async (roundedRoutes)=>{
        if(typeof selectedRoute == 'undefined') {
          let selectRoute = roundedRoutes[0]
          setSelectedRoute(selectRoute)
        } else {
          const updatedSelectedRoute = roundedRoutes[roundedRoutes.findIndex((route)=>(route.fromToken.address == selectedRoute.fromToken.address && route.blockchain == selectedRoute.blockchain))]
          if(updatedSelectedRoute) {
            if(selectedRoute.fromAmount != updatedSelectedRoute.fromAmount) {
              setUpdatedRouteWithNewPrice(updatedSelectedRoute)
            } else if ( // other reasons but price to update selected route
              selectedRoute.approvalRequired != updatedSelectedRoute.approvalRequired
            ) {
              setSelectedRoute(updatedSelectedRoute)
            }
          } else {
            setSelectedRoute(roundedRoutes[0])
          }
        }
        setAllRoutes(roundedRoutes)
        if(props.setMaxRoute) { props.setMaxRoute(findMaxRoute(roundedRoutes)) }
      })
    }
  }
  
  const getPaymentRoutes = async ({ allRoutes, selectedRoute, updatable })=>{
    if(updatable == false || !props.accept || !account) { return }
    if(!props.accept.some((configuration)=>wallet.blockchains.includes(configuration.blockchain))) {
      return setWalletMissesBlockchainSupport(true)
    }
    let slowRoutingTimeout = setTimeout(() => { setSlowRouting(true) }, 4000)
    return await routePayments(Object.assign({}, props, { account })).then((routes)=>{
      clearInterval(slowRoutingTimeout)
      onRoutesUpdate(routes)
    })
  }

  const updateRouteAmount = (route, amountBN)=> {
    route.fromAmount = amountBN.toString()
  }

  const roundAmount = async (route, amountBN)=> {
    if(route.directTransfer){ return route }
    let readableAmount = await route.fromToken.readable(amountBN || route.fromAmount)
    let roundedAmountBN = await route.fromToken.BigNumber(round(readableAmount))
    updateRouteAmount(route, roundedAmountBN)
    return route
  }

  const roundAmounts = async (routes)=> {
    return Promise.all(routes.map((route)=>roundAmount(route)))
  }

  const updateRouteWithNewPrice = async ()=> {
    setSelectedRoute({...updatedRouteWithNewPrice})
    setUpdatedRouteWithNewPrice(null)
  }

  const refreshPaymentRoutes = ()=>{
    return getPaymentRoutes({ allRoutes, selectedRoute, updatable })
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setReloadCount(reloadCount + 1)
      getPaymentRoutes({ allRoutes, selectedRoute, updatable })
    }, 15000);

    return () => clearTimeout(timeout)
  }, [reloadCount, allRoutes, selectedRoute, updatable])

  useEffect(() => {
    if(account && props.accept && recover == undefined) {
      refreshPaymentRoutes()
    }
  }, [account, props.accept])

  if(walletMissesBlockchainSupport) {

    return(
      <ReactDialogStack
        open={ open }
        close={ close }
        start='WalletMissesBlockchainSupport'
        container={ props.container }
        document={ props.document }
        dialogs={{
          WalletMissesBlockchainSupport: <WalletMissesBlockchainSupportDialog/>,
          PaymentBlockchains: <PaymentBlockchainsDialog/>,
        }}
      />
    )

  } else {

    return(
      <PaymentRoutingContext.Provider value={{
        selectedRoute,
        setSelectedRoute,
        refreshPaymentRoutes,
        allRoutes,
        setAllRoutes,
        slowRouting,
        updatedRouteWithNewPrice,
        updateRouteWithNewPrice
      }}>
        { props.children }
      </PaymentRoutingContext.Provider>
    )
  }
}
