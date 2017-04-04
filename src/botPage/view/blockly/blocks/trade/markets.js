import { observer as globalObserver } from 'binary-common-utils/lib/observer'
import config from '../../../../common/const'
import { symbolApi } from '../../../shared'
import { findTopParentBlock } from '../../utils'
import { updateInputList } from './tools'

// Backward Compatibility Separate market blocks into one

const initialBlocks = (block, tradeOptions) => {
  const parent = block.parentBlock_
  if (parent) {
    const initStatement = block.getInput('INITIALIZATION').connection
    const ancestor = findTopParentBlock(parent)
    initStatement.connect((ancestor || parent).previousConnection)
    if (parent.nextConnection) {
      parent.nextConnection.connect(tradeOptions.previousConnection)
    } else {
      const statementConnection = parent.getInput('SUBMARKET').connection
      statementConnection.connect(tradeOptions.previousConnection)
    }
  }
}

export default () => {
  const symbols = symbolApi.activeSymbols.getSymbols()
  Object.keys(symbols).forEach(k => {
    Blockly.Blocks[k] = {
      init: function init() {
        this.appendStatementInput('CONDITION')
          .setCheck('Condition')
        this.setPreviousStatement(true, null)
      },
      onchange: function onchange(ev) {
        if (ev.type === Blockly.Events.CREATE
          && ev.ids.indexOf(this.id) >= 0) {
          const recordUndo = Blockly.Events.recordUndo
          Blockly.Events.recordUndo = false
          Blockly.Events.setGroup('BackwardCompatibility')
          const tradeOptions = Blockly.mainWorkspace.newBlock('tradeOptions')
          tradeOptions.initSvg()
          tradeOptions.render()
          initialBlocks(this, tradeOptions)
          const symbol = symbols[this.type]
          const parent = findTopParentBlock(tradeOptions)
          if (parent) {
            parent.setFieldValue(symbol.market, 'MARKET_LIST')
            parent.setFieldValue(symbol.submarket, 'SUBMARKET_LIST')
            parent.setFieldValue(symbol.symbol, 'SYMBOL_LIST')
            globalObserver.emit('bot.init', symbol.symbol)
            if (this.getChildren().length) {
              const condition = this.getChildren()[0]
              const tradeType = condition.type
              const categories = config.conditionsCategory
              Object.keys(categories).forEach(cat => {
                if (categories[cat].indexOf(tradeType) >= 0) {
                  parent.setFieldValue(cat, 'TRADETYPECAT_LIST')
                  parent.setFieldValue(tradeType, 'TRADETYPE_LIST')
                }
              })
            }
          }
          updateInputList(tradeOptions)
          if (this.getChildren().length) {
            const condition = this.getChildren()[0]
            const fieldList = ['DURATIONTYPE_LIST', 'CURRENCY_LIST',
              'BARRIEROFFSETTYPE_LIST', 'SECONDBARRIEROFFSETTYPE_LIST']
            fieldList.forEach(field => {
              const value = condition.getFieldValue(field)
              if (value) {
                tradeOptions.setFieldValue(value, field)
              }
            })
            condition.inputList.forEach(input => {
              if (input.connection && input.connection.targetConnection) {
                tradeOptions.getInput(input.name).connection.connect(input.connection.targetConnection)
              }
            })
          }
          this.dispose()
          Blockly.Events.setGroup(false)
          Blockly.Events.recordUndo = recordUndo
        }
      },
    }
    Blockly.JavaScript[k] = () => ''
  })
}
