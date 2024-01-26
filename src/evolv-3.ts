import {
  Transfer as TransferEvent
} from "../generated/Evolv3/Evolv3"
import { ArtistStatistic, Artist, Artwork, PaintToken } from "../generated/schema"
import { ethereum } from '@graphprotocol/graph-ts'
import { Address, BigInt, ByteArray } from '@graphprotocol/graph-ts'

export let ZERO_ADDRESS = Address.fromString(
  '0x0000000000000000000000000000000000000000'
)
export let PAINT_TOKEN_ADDRESS = Address.fromString(
  '0x7c28f627ea3aec8b882b51eb1935f66e5b875714'
)

export function isMintEvent (event: TransferEvent): bool {
  return event.params.from == ZERO_ADDRESS
}

export function isPaintBurnLog (log: ethereum.Log): bool {
  if(log.address != PAINT_TOKEN_ADDRESS || log.topics.length != 3) {
    return false
  }
  let includesBurnTopic = false
  for(let j = 0; j < log.topics.length; j++) {
    let topic = log.topics[j]
    if(topic.toHexString() == "0x0000000000000000000000000000000000000000000000000000000000000000"){
      includesBurnTopic = true
      break
    }
  }

  return includesBurnTopic
}

export function handleTransfer(event: TransferEvent): void {
  if(!isMintEvent(event)) {
    return
  }
  let receipt = event.receipt
  let logs = receipt && receipt.logs ? receipt.logs : []

  let artistStatistic = ArtistStatistic.load('1')
  if(artistStatistic == null) {
    artistStatistic = new ArtistStatistic('1')
    artistStatistic.totalArtists = BigInt.fromI32(0)
    artistStatistic.totalArtworks = BigInt.fromI32(0)
  }

  let artist = Artist.load(event.params.to.toHex())
  if(artist == null) {
    artist = new Artist(event.params.to.toHex())
    artist.artworksCreated = BigInt.fromI32(0)
    artistStatistic.totalArtists = artistStatistic.totalArtists.plus(BigInt.fromI32(1))
  }
  
  artist.artworksCreated = artist.artworksCreated.plus(BigInt.fromI32(1))
  artist.save()

  let artwork = new Artwork(event.params.tokenId.toString())
  artwork.artist = artist.id
  artwork.tokenId = event.params.tokenId
  artwork.transactionHash = event.transaction.hash
  artwork.paintBurnedRaw = ''
  artwork.paintBurned = BigInt.fromI32(0)
  
  artistStatistic.totalArtworks = artistStatistic.totalArtworks.plus(BigInt.fromI32(1))
  artistStatistic.save()

  let paintToken = PaintToken.load("paint")
  if(paintToken == null) {
    paintToken = new PaintToken("paint")
    paintToken.totalPaintBurned = BigInt.fromI32(0)
  }

  // find the paint transfer event
  for(let i = 0; i < logs.length; i++) {
    let log = logs[i]

    if(isPaintBurnLog(log)) {
      let paintBurnedHex = log.data.toHexString()
      let paintBurned = BigInt.fromByteArray(ByteArray.fromHexString(paintBurnedHex).reverse() as ByteArray)
      artwork.paintBurnedRaw = paintBurnedHex
      artwork.paintBurned = paintBurned
      paintToken.totalPaintBurned = paintToken.totalPaintBurned.plus(paintBurned)
      break
    }
  }
  paintToken.save()
  artwork.save()
}
