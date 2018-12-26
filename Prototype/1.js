; (function () {

    String.prototype.printf = function (keyValues) {
      var formatted = this;
      if (keyValues) {
        for (var k in keyValues) {
          var regexp = new RegExp('\\{' + k + '\\}', 'gi');
          formatted = formatted.replace(regexp, keyValues[k]);
        }
      }
      return formatted;
    };
  
    if (!String.prototype.trim) {
      String.prototype.trim = function () {
        return this.replace(/(^[\s\n\t]+|[\s\n\t]+$)/g, "");
      }
    }
  
    var MCE = { };
    MCE._config = {
      contentPadding: 15, // 内容填充
      listContentPadding: 35 + 15, // 列表内容填充
      lineHeight: 30, // 行高
      touchlongTime: 300, // 触发长按时长
      clientTextLength: 300, // 客户端文本截取长度限定
      selectedBackgroundColor: "rgba(251, 176, 59, 0.3)", // 选中文本的背景颜色
      maxContentHeight: 60000, // 限制内容高度
      maxContentHeight_errorText: "备忘内容已达到最大限制，无法增加更多内容", // 内容高度达到最大值时的文字提示
      audioHeight: 44, // 音频高度
      trueAudioHeight: 88, // 真音频高度
      audioProgressBar: { // 音频进度条X位置 以资源X坐标为基准
        left: 72,
        right: window.innerWidth - 15 * 2 - 44,
        width: window.innerWidth - 15 * 2 - 44 - 72,
      },
      listStyle: { // 列表类型
        "CIRCLE": 0, // 实心圆
        "TASK": 1, // 待办
        "NUMBER": 2, // 数字
        "LETTER": 3, // 字母
      },
      operationMenuHeight: 50, // 操作菜单判定高度
    };
  
    MCE.init = function (content) {
      if (this._contentDom) {
        return;
      }
      window.eruda && window.eruda.init();
      this.DEBUGER = true;
      this.content = content;
      this.viewAreaHeight = window.innerHeight;
      this._clipboardContent = "粘贴板";
      this._autoUUID = 0;
      this._imageCache = {};
  
      this._initVirtualInput();
      this._initDom();
      this._initEvent();
      this.setEditing(true);
  
      this._historyListener = true;
  
      this._save = false;   //记录保存与否
  
      // setInterval(function(){
      //   console.log(window.getSelection().getRangeAt(0));
      // }, 1000);
  
      return true;
    }
  
    MCE._initDom = function () {
  
      MCE._contentDom = document.createElement("div");
      MCE._contentDom.id = "content";
      document.getElementById("layout").appendChild(MCE._contentDom);
      if (MCE.content) {
        MCE.DEBUGER && console.log(MCE.content);
        MCE._contentDom.innerHTML = MCE.content;
        if(MCE._contentDom.children.length > 0) {
          // 分割文本并加上唯一ID
          var node;
          for (var i = 0; i < MCE._contentDom.children.length; ++i) {
            node = MCE._contentDom.children[i];
            if (node.nodeName.toLowerCase() == "p") {
              node.id = "i" + (++MCE._autoUUID);
              if(node.children.length < 1 && node.innerText.length > 0) { // 纯文本P
                var text = node.innerText;
                node.innerHTML = "";
                node.appendChild(MCE._ss());
                MCE._cursorNode = node.firstElementChild;
                MCE.insertText(text, true);
              } else {
                if(node.children.length == 0) { // 在行数据前面添加空标签
                  node.appendChild(MCE._ss());
                }
                if(node.children[0].innerHTML !== "") {
                  MCE._insertBefore(MCE._ss(), node.children[0]);
                }
                for(var j = 0; j < node.children.length; ++j) {
                  if(node.children[j].nodeName.toLowerCase() == "s") { // 兼容旧数据
                    MCE._insertAfter(MCE._ss(node.children[j].innerText), node.children[j]);
                    node.children[j].remove();
                  } else {
                    node.children[j].id = "i" + (++MCE._autoUUID);
                  }
                }
              }
            } else if(node.nodeName.toLowerCase() == "canvas") { // 兼容旧数据
              node.id = "i" + (++MCE._autoUUID);
              var p = MCE._p();
              p.classList.add("resourceBox");
              MCE._insertAfter(p, node);
              p.appendChild(node.cloneNode(true));
              node.remove();
            }
          }
          MCE._cursorNode = node.firstChild;
        } else {
          MCE._contentDom.innerHTML = "";
          MCE._contentDom.appendChild(MCE._p(MCE.content));
        }
      } else {
        MCE._contentDom.appendChild(MCE._p());
        MCE._setCursor(MCE._contentDom.lastChild);
      }
  
      MCE._onInput.call(MCE._contentDom);
  
      MCE._initOperationMenu();
  
      MCE._resourceWidth = (MCE._contentDom.offsetWidth - MCE._config.contentPadding) * 2;
  
      MCE._resetSelectController();
  
      MCE.dscroll = new DScroll(MCE._contentDom, {
        scroll: function(dt, db) {
          MCE._updateCursorTop();
          MCE._updateSelectController();
        },
        touchstart: MCE.onTouchstart,
        touchmove: MCE.onTouchmove,
        touchend: MCE.onTouchend,
        resize: MCE.onResize
      });
  
      MCE._renderAllResource();
  
      MCE.DEBUGER && console.log(MCE._contentDom.innerHTML);
    }
  
    MCE._initOperationMenu = function() {
      MCE._operationMenu = document.createElement("div");
      MCE._operationMenu.classList.add("operationMenu");
      MCE._operationMenu.appendChild(IMAGE_TOUCHLONG_MENU_POINTER);
      document.getElementById("layout").appendChild(MCE._operationMenu);
  
      MCE._operationMenuBtnBox = document.createElement("div");
      MCE._operationMenuBtnBox.classList.add("menus");
      MCE._operationMenu.appendChild(MCE._operationMenuBtnBox);
      MCE._operationMenu.btns = {
        select: document.createElement("p"),
        selectAll: document.createElement("p"),
        cut: document.createElement("p"),
        copy: document.createElement("p"),
        paste: document.createElement("p"),
        delete: document.createElement("p"),
      };
      MCE._operationMenu.btns.select.innerHTML = "选择";
      MCE._operationMenu.btns.selectAll.innerHTML = "全选";
      MCE._operationMenu.btns.cut.innerHTML = "剪切";
      MCE._operationMenu.btns.copy.innerHTML = "复制";
      MCE._operationMenu.btns.paste.innerHTML = "粘贴";
      MCE._operationMenu.btns.delete.innerHTML = "删除";
    }
  
    MCE._showOperationMenu = function() {
      // 先移除全部按钮
      while(MCE._operationMenuBtnBox.children.length > 0) {
        MCE._operationMenuBtnBox.children[0].remove();
      }
  
      var selecteds = document.getElementsByClassName("selected");
      if(selecteds.length == 1 && selecteds[0].classList.contains("resource")) {
        MCE._operationMenuBtnBox.appendChild(MCE._operationMenu.btns.delete);
      } else {
        if(selecteds.length == 0 && (MCE._contentDom.innerText.length > 0 || document.getElementsByClassName("resource").length > 0)) {
          MCE._operationMenuBtnBox.appendChild(MCE._operationMenu.btns.select);
          MCE._operationMenuBtnBox.appendChild(MCE._operationMenu.btns.selectAll);
        }
        if(selecteds.length > 0) {
          MCE._operationMenuBtnBox.appendChild(MCE._operationMenu.btns.cut);
          MCE._operationMenuBtnBox.appendChild(MCE._operationMenu.btns.copy);
        }
        if(MCE._clipboardContent.length > 0) {
          MCE._operationMenuBtnBox.appendChild(MCE._operationMenu.btns.paste);
        }
      }
      if(MCE._operationMenuBtnBox.children.length == 0) return false;
  
      // 元素不可见时，宽度不准确，获取到的是上次可见时的宽度,所以使用计算的宽度
      var menuWidth = MCE._operationMenuBtnBox.children.length * 51 + 9;
      if(selecteds.length == 0) {
        var nodeOffset = MCE._getOffsetOfDocument(MCE._cursorNode);
        var cleft = parseInt(MCE._cursor.style.left);
        var mleft = cleft - menuWidth / 2;
        mleft = Math.min(Math.max(mleft, MCE._config.contentPadding), window.innerWidth - MCE._config.contentPadding - menuWidth);
        var piLeft = cleft - mleft - 8;
        piLeft = Math.min(Math.max(piLeft, 6), menuWidth - 20);
        IMAGE_TOUCHLONG_MENU_POINTER.style.left = piLeft + "px";
        MCE._operationMenu.style.left = mleft + "px";
    
        var top;
        if(nodeOffset.y + MCE._contentDom.y < MCE._config.operationMenuHeight) { // 操作菜单置反
          top = nodeOffset.y + MCE._contentDom.y + 15 + MCE._cursorNode.offsetHeight;
          IMAGE_TOUCHLONG_MENU_POINTER.style.top = "-8px";
          IMAGE_TOUCHLONG_MENU_POINTER.style.transform = "rotate(180deg)";
        } else {
          top = nodeOffset.y - MCE._config.operationMenuHeight + MCE._contentDom.y;
          top = Math.min(top, window.innerHeight - MCE._config.operationMenuHeight);
          IMAGE_TOUCHLONG_MENU_POINTER.style.top = "35px";
          IMAGE_TOUCHLONG_MENU_POINTER.style.transform = "rotate(0deg)";
        }
        MCE._operationMenu.style.top = top + "px";
  
      } else {
        var selectedStartNodeOffset = MCE._getOffsetOfDocument(MCE._selectedStartNode);
        var selectedEndNodeOffset = MCE._getOffsetOfDocument(MCE._selectedEndNode);
        var selectedLeft = selectedStartNodeOffset.y != selectedEndNodeOffset.y ? MCE._config.contentPadding : selectedStartNodeOffset.x;
        var selectedRight = selectedStartNodeOffset.y != selectedEndNodeOffset.y ? window.innerWidth - MCE._config.contentPadding : selectedEndNodeOffset.x + MCE._selectedEndNode.offsetWidth;
        var selectedTop = selectedStartNodeOffset.y;
        var selectedBottom = selectedEndNodeOffset.y + MCE._selectedEndNode.offsetHeight;
  
        var left = (selectedLeft + selectedRight) / 2 - menuWidth / 2;
        left = Math.min(Math.max(left, 5), window.innerWidth - 5 - menuWidth);
        IMAGE_TOUCHLONG_MENU_POINTER.style.left = (selectedLeft + selectedRight) / 2 - left - 8 + "px";
        MCE._operationMenu.style.left = left + "px";
  
        if(selectedTop + MCE._contentDom.y < MCE._config.operationMenuHeight && selectedBottom + MCE._contentDom.y + MCE._config.operationMenuHeight > window.innerHeight) {
          MCE._operationMenu.style.top = window.innerHeight / 2 + "px";
          IMAGE_TOUCHLONG_MENU_POINTER.style.top = "35px";
          IMAGE_TOUCHLONG_MENU_POINTER.style.transform = "rotate(0deg)";
        } else if(selectedTop + MCE._contentDom.y > MCE._config.operationMenuHeight) {
          MCE._operationMenu.style.top = selectedTop - MCE._config.operationMenuHeight + MCE._contentDom.y - 5 + "px";
          IMAGE_TOUCHLONG_MENU_POINTER.style.top = "35px";
          IMAGE_TOUCHLONG_MENU_POINTER.style.transform = "rotate(0deg)";
        } else if(selectedBottom + MCE._contentDom.y + MCE._config.operationMenuHeight < window.innerHeight) {
          MCE._operationMenu.style.top = selectedBottom + MCE._contentDom.y + 15 + "px";
          IMAGE_TOUCHLONG_MENU_POINTER.style.top = "-8px";
          IMAGE_TOUCHLONG_MENU_POINTER.style.transform = "rotate(180deg)";
        }
      }
    }
  
    MCE._hideOperationMenu = function(){
      MCE._operationMenu.style.left = "-1000px";
    }
  
    // 初始化虚拟输入框
    MCE._initVirtualInput = function () {
      MCE._cursor = document.createElement("canvas");
      MCE._cursor.id = "cursor";
      MCE._cursor.width = 2;
      MCE._cursor.height = 20;
      MCE._cursorCtx = MCE._cursor.getContext("2d");
      MCE._cursorFlickerFlag = true;
      MCE._cursorHidden = false;
      document.getElementById("layout").appendChild(MCE._cursor);
  
      MCE._virtualInput = document.createElement("input");
      MCE._virtualInput.classList.add("cursorInput");
      document.getElementById("layout").appendChild(MCE._virtualInput);
  
      // 部分浏览器不兼容此事件，事件消息中，data属性为空 所以使用自定义输入事件
      window.requestAnimationFrame(MCE._checkInput);
  
      MCE._virtualInput.addEventListener("compositionstart", MCE._onCompositionstart);
      MCE._virtualInput.addEventListener("compositionupdate", MCE._onCompositionupdate);
      MCE._virtualInput.addEventListener("compositionend", MCE._onCompositionend);
      MCE._virtualInput.addEventListener("focus", MCE._onFocus);
      MCE._virtualInput.addEventListener("blur", MCE._onBlur);
  
      MCE._virtualInputValue = "";
  
    }
  
    MCE._checkInput = function() {
      if(!MCE._cpLock) {
        if(MCE._virtualInput.value != MCE._virtualInputValue) {
          var data = MCE._virtualInput.value.substr(MCE._virtualInputValue.length);
          MCE._virtualInputValue = MCE._virtualInput.value;
          if(data) MCE._onInput.call(MCE._virtualInput, { // 构造一个inputEvent事件
            inputType: "insertText",
            data: data
          });
        }
      }
      window.requestAnimationFrame(MCE._checkInput);
    }
  
    MCE._setCursorHidden = function(isHidden){
      MCE._cursorHidden = isHidden || false;
      MCE._cursorFlickerFlag = MCE._cursorHidden ? false : true;
      MCE._cursorFlicker();
    }
  
    MCE._cursorFlicker = function() {
      MCE._cursor.height = Math.max(MCE._cursorNode.offsetHeight, 20);
      if (MCE._cursorFlickerFlag && !MCE._cursorHidden) {
        MCE._cursorCtx.fillStyle = "rgb(251, 176, 59)";
        MCE._cursorCtx.fillRect(0, 0, MCE._cursor.width, MCE._cursor.height);
      } else {
        MCE._cursorCtx.clearRect(0, 0, MCE._cursor.width, MCE._cursor.height);
      }
      MCE._cursorFlickerFlag = !MCE._cursorFlickerFlag;
      MCE._cursorFlickerTimer && clearTimeout(MCE._cursorFlickerTimer);
      MCE._cursorFlickerTimer = setTimeout(MCE._cursorFlicker, 500);
    }
  
    MCE._initEvent = function () {
      document.addEventListener("paste", MCE.onPaste);
  
      // 主动触发一次input事件
      MCE._onInput.call(MCE._contentDom);
  
      window.addEventListener("keydown", function (e) {
        // console.log(e.keyCode);
        // 自定义回退事件
        // 系统回退会一次性删除多个资源段（并列的多个资源段）或者会无法删除资源段（资源段在最顶部时有几率）
        if (e.key == "Backspace" || e.keyCode == 8) {
          MCE.DEBUGER && console.log("Backspace", e);
          if(!MCE._cpLock) {
            e.preventDefault();
            e.stopPropagation();
  
            MCE._insertHistory();
            MCE._backDelete();
            if(MCE._history[MCE._historyIndex].length == 0) {
              MCE._history.pop();
              MCE._historyIndex--;
            }
            return false;
          }
        }
  
        // 自定义回车事件
        if (e.key == "Enter" || e.keyCode == 13) {
          e.preventDefault();
          e.stopPropagation();
  
          MCE._insertHistory();
          MCE.newLine();
  
          return false;
        }
  
        if (e.altKey) {
          if (e.key == "b" || e.keyCode == 66) { // 加粗
            MCE.setBold();
          }
          if (e.key == "i" || e.keyCode == 73) { // 斜线
            MCE.setItalic();
          }
          if (e.key == "u" || e.keyCode == 85) { // 下划线
            MCE.setUnderline();
          }
          if (e.key == "l" || e.keyCode == 76) { // 左对齐
            MCE.setLeftAlign();
          }
          if (e.key == "r" || e.keyCode == 82) { // 右对齐
            MCE.setRightAlign();
          }
          if (e.key == "c" || e.keyCode == 67) { // 居中对齐
            MCE.setCenterAlign();
          }
          if (e.key == "a" || e.keyCode == 65) { // 插入音频
            MCE.insertAudio(Date.now(), 10, "Your eyes are pretty.But mine are pretter than yours.Why?Because you're in my eyes. 你的眼睛真美。但是我的比你的更美。为什么？因为你在我的眼中啊");
          }
          if (e.key == "v" || e.keyCode == 86) { // 插入视频
            MCE.insertVideo(Date.now(), "data:image/jpeg;base64,/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAAAAAAD/7QAsUGhvdG9zaG9wIDMuMAA4QklNBCUAAAAAABAAAAAAAAAAAAAAAAAAAAAA/+4ADkFkb2JlAGTAAAAAAf/bAIQAGxoaKR0pQSYmQUIvLy9CRz8+Pj9HR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHRwEdKSk0JjQ/KCg/Rz81P0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dH/8AAEQgAJQAyAwEiAAIRAQMRAf/EARsAAAMBAQEBAQEBAQEAAAAAAAEAAgMEBQYHCAkKCwEBAQEBAQEBAQEBAQEAAAAAAAECAwQFBgcICQoLEAACAgEDAgMEBwYDAwYCATUBAAIRAyESMQRBUSITYXEygZGxQqEF0cEU8FIjcjNi4YLxQzSSorIV0lMkc8JjBoOT4vKjRFRkJTVFFiZ0NlVls4TD03Xj80aUpIW0lcTU5PSltcXV5fVWZnaGlqa2xtbm9hEAAgIABQEGBgEDAQMFAwYvAAERAiEDMUESUWFxgZEiEzLwobEEwdHh8UJSI2JyFJIzgkMkorI0U0Rjc8LSg5OjVOLyBRUlBhYmNWRFVTZ0ZbOEw9N14/NGlKSFtJXE1OT0pbXF1eX1VmZ2hv/aAAwDAQACEQMRAD8ACCtsTL1klauQvUOHi3PSJ6PKzPVWrN8fL0PLjnq77nztnSC1Y3K4kQeaxJ7WZPrdjmq4nE9I4S6h42sd0gYuXdiHLs8WwyFbVzJDnYkqvqZlakOwVXmzqVj5dlV4swxVVckP/9k=", 750, 200, Math.floor(Math.random() * 100) + 10);
          }
          if (e.key == "q" || e.keyCode == 81) { // 插入图片
            MCE.insertImage(Date.now(), "data:image/jpeg;base64,/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAAAAAAD/7QAsUGhvdG9zaG9wIDMuMAA4QklNBCUAAAAAABAAAAAAAAAAAAAAAAAAAAAA/+4ADkFkb2JlAGTAAAAAAf/bAIQAGxoaKR0pQSYmQUIvLy9CRz8+Pj9HR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHRwEdKSk0JjQ/KCg/Rz81P0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dH/8AAEQgAJQAyAwEiAAIRAQMRAf/EARsAAAMBAQEBAQEBAQEAAAAAAAEAAgMEBQYHCAkKCwEBAQEBAQEBAQEBAQEAAAAAAAECAwQFBgcICQoLEAACAgEDAgMEBwYDAwYCATUBAAIRAyESMQRBUSITYXEygZGxQqEF0cEU8FIjcjNi4YLxQzSSorIV0lMkc8JjBoOT4vKjRFRkJTVFFiZ0NlVls4TD03Xj80aUpIW0lcTU5PSltcXV5fVWZnaGlqa2xtbm9hEAAgIABQEGBgEDAQMFAwYvAAERAiEDMUESUWFxgZEiEzLwobEEwdHh8UJSI2JyFJIzgkMkorI0U0Rjc8LSg5OjVOLyBRUlBhYmNWRFVTZ0ZbOEw9N14/NGlKSFtJXE1OT0pbXF1eX1VmZ2hv/aAAwDAQACEQMRAD8ACCtsTL1klauQvUOHi3PSJ6PKzPVWrN8fL0PLjnq77nztnSC1Y3K4kQeaxJ7WZPrdjmq4nE9I4S6h42sd0gYuXdiHLs8WwyFbVzJDnYkqvqZlakOwVXmzqVj5dlV4swxVVckP/9k=", 750, 20000);
          }
          if (e.key == "w" || e.keyCode == 87) { // 设置段落为列表
            MCE.setList(1);
          }
          if (e.key == "n" || e.keyCode == 78) { // 撤销
            MCE.undo();
          }
          if (e.key == "m" || e.keyCode == 77) { // 恢复撤销
            MCE.redo();
          }
          if (e.key == ";" || e.keyCode == 186) { // 恢复撤销
            MCE.save();
          }
          if (e.key == "t" || e.keyCode == 84) { // 获取焦点
            MCE.focus();
          }
          if (e.key == "y" || e.keyCode == 89) { // 失去焦点
            MCE.blur();
          }
          if (e.key == "," || e.keyCode == 188) { // 开始录制音频
            MCE.startAudio();
          }
          if (e.key == "." || e.keyCode == 190) { // 结束音频录制
            MCE.endAudio(Date.now(), 10);
          }
          if (e.key == "/" || e.keyCode == 191) { // 更新录制音频文字
            var strings = [
              "123",
              "adsf",
              "基本原则"
            ];
            MCE.updateAudioText(MCE._editingAudio.p.innerText + strings[parseInt(Math.random() * strings.length)]);
          }
        }
      });
  
    }
  
    MCE.setEditing = function (canEdit) {
      MCE._canEdit = canEdit;
      if(!MCE._canEdit) {
        MCE._virtualInput.blur();
      }
      MCE._sendClientMessage_historyStatus();
    }
  
    MCE.save = function () {
      if (!MCE._contentDom) {
        return;
      }
      MCE.blur();
      MCE._save = true;  //已点击保存
      if(MCE._cpLock) { // 在组合输入状态时，将组合输入的内容添加到结果HTML
        MCE._cpLock = false;
        var cpText = MCE._compositionDom.innerHTML;
        MCE._cursorNode = MCE._compositionDom.previousSibling;
        MCE._cursorNodeLocation = false;
        MCE._compositionDom.remove();
        MCE.insertText(cpText, true);
        MCE._virtualInputValue += cpText;
        MCE._virtualInput.value = MCE._virtualInputValue;
        MCE._onInput.call(MCE._contentDom);
      }
      MCE._cancelSelectedContent();
      var resource = MCE.getAllResource();
      var html = MCE._contentDom.innerHTML;
      var text = MCE._contentDom.innerText.replace(/\n{2,}/ig, "\n");
      text = text.replace(/^\n|\n$/ig, "")
  
      // 移除s标签 及 p标签的ID属性
      html = html.replace(/<ss\s(id="[\w\-]+")([^>]*)>/ig, "<ss$2>");
      html = html.replace(/<p\s(id="[\w\-]+")([^>]*)>/ig, "<p$2>");
      // 移除换行符
      html = html.replace(/\n/ig, "");
  
      // 取所有图片和视频ID
      var iav = MCE.getIAV();
      var iavIds = [];
      for(var i = 0; i < iav.length; ++i) {
        iavIds.push(iav[i].id);
      }
      var listJson = { // 客户端列表展示的信息
        audio: "",
        text: text.substr(0, Math.min(text.length, MCE._config.clientTextLength)), // 文本限定
        iav: iavIds
      };
      // 取第一个音频ID
      for (var i = 0; i < resource.length; ++i) {
        if (resource[i].type == "audio") {
          listJson.audio = resource[i].id;
          break;
        }
      }
  
      var rs = {
        resource: resource,
        html: html,
        text: text,
        listJson: JSON.stringify(listJson)
      };
  
      MCE.DEBUGER && console.log("save", rs);
      return rs;
  
    }
  
    MCE.removeListStyle = function (node) {
      MCE._history_removeAttribute(node, "data-list-style");
      MCE._history_removeAttribute(node, "data-before");
      MCE._history_removeClassName(node, "list");
      return node;
    }
  
    MCE.newLine = function (noCursor) {
  
      var p = MCE._cursorNode.parentElement;
  
      if (p.classList.contains("list") && p.children.length <= 1) {
        MCE.removeListStyle(p);
        if (!noCursor) MCE._setCursor(MCE._cursorNode);
        return;
      }
  
      var np = MCE._p();
      np.style.textAlign = p.style.textAlign; // 继承文本对齐方式
      if(p.classList.contains("resourceBox") && MCE._cursorNodeLocation) {
        MCE._history_insertElement(np, p, "before");
  
        if (!noCursor){
          MCE._setCursor(np.firstChild);
          MCE._updateLastHistoryStepCursor();
        }
    
      } else {
        MCE._history_insertElement(np, p, "after");
  
        var startNode = MCE._cursorNodeLocation ? MCE._cursorNode.previousSibling : MCE._cursorNode;
        while (startNode.nextSibling) {
          MCE._history_transferElement(startNode.nextSibling, startNode, np.lastChild);
        }
  
        if (!noCursor){
          MCE._setCursor(np.firstChild);
          MCE._updateLastHistoryStepCursor();
        }
  
        var prevCursorNode = startNode;
        // 继承文本样式
        MCE._textStyle = MCE._getNodeStyle(prevCursorNode);
  
        if (p.classList.contains("list")) {
          MCE.setList(p.getAttribute("data-list-style"));
        }
      }
      MCE._onInput.call(MCE._contentDom);
      return np;
    }
  
    MCE._backDelete = function () {
  
      MCE._hideOperationMenu();
      if(!MCE._deleteSelectedContent()) { // 先尝试删除选择的元素
        MCE._deleteCursorNode(); // 删除光标元素
      }
      MCE._onInput.call(MCE._contentDom);
    }
  
    MCE._deleteCursorNode = function() {
      var p = MCE._cursorNode.parentElement;
      if(p.classList.contains("resourceBox")) { // 资源
        if(MCE._cursorNode.classList.contains("selected")) { // 该元素为选中状态，删除它
          var ncursor;
          if(p.previousSibling) ncursor = p.previousSibling.lastChild;
          else if(p.nextSibling) ncursor = p.nextSibling.firstChild;
          MCE._history_removeElement(p);
          MCE._setCursor(ncursor);
          MCE._updateLastHistoryStepCursor();
        } else {
          if(!MCE._cursorNodeLocation) { // 如果要删除的元素为资源，则先选中该资源
            MCE._selectContent(MCE._cursorNode);
          } else if(p.previousSibling) { // 光标定位到上一段末尾再进行删除操作
            if(p.previousSibling.children.length > 1) {
              MCE._setCursor(p.previousSibling.lastChild);
              MCE._deleteCursorNode();
            } else {
              MCE._history_removeElement(p.previousSibling);
            }
          }
        }
      } else {
        if (p.firstChild == MCE._cursorNode || (p.firstChild.nextSibling == MCE._cursorNode && MCE._cursorNodeLocation)) { // 光标在段落头时
          if (p.classList.contains("list")) { // 如果该段为列表，清除列表
            MCE.removeListStyle(p);
            MCE._setCursor(MCE._cursorNode, MCE._cursorNodeLocation);
            MCE._updateLastHistoryStepCursor();
          } else if(p.previousSibling) { // 如果该段落之前还有段落
            if (p.previousSibling.classList.contains("resourceBox") && !p.previousSibling.lastChild.classList.contains("selected")) { // 如果上一段落为资源，选中该资源
              MCE._setCursor(p.previousSibling.lastChild, false);
              MCE._selectContent(p.previousSibling.lastChild);
            } else { // 上一段落为普通文本，合并本段落的文本到上一段落
              var prevNode = p.previousSibling.lastChild;
              while (p.children.length > 1) {
                MCE._history_transferElement(p.children[1], p.children[0], p.previousSibling.lastChild);
              }
              MCE._history_removeElement(p);
              MCE._setCursor(prevNode, false);
              MCE._updateLastHistoryStepCursor();
            }
          } else {
            if(p != MCE._contentDom.firstChild && MCE._contentDom.children.length > 1) {
              var ncn, ncnl;
              if(p.nextSibling.children.length > 1) {
                ncn = p.nextSibling.children[1];
                ncnl = true;
              } else {
                ncn = p.nextSibling.firstChild;
                ncnl = false;
              }
              MCE._history_removeElement(p);
              MCE._setCursor(ncn, ncnl);
              MCE._updateLastHistoryStepCursor();
            }
          }
        } else { // 光标在非段落头时
          var rnode = MCE._cursorNodeLocation ? MCE._cursorNode.previousSibling : MCE._cursorNode;
          var prevNode = rnode.previousSibling;
          MCE._history_removeElement(rnode);
          MCE._setCursor(prevNode, false);
          MCE._updateLastHistoryStepCursor();
        }
      }
      MCE._onInput.call(MCE._contentDom);
    }
  
    MCE._onInput = function (e) {
      MCE.DEBUGER && console.log("onInput", e, "_cpLock", MCE._cpLock, "e.inputType", e && (e.inputType || e.type));
      if (!MCE._cpLock) {
        if (e && (e.inputType == "insertText"
          || e.inputType == "insertCompositionText"
          || e.type == "compositionend"
          || e.type == "input")) {
          // 将用户输入的文字展示到内容区
          MCE._insertHistory();
          
          MCE.insertText(e.data);
        }
      }
  
      if(MCE._historyListener) {
        // 保证编辑器结尾为非资源
        if(MCE._contentDom.children.length == 0 || MCE._contentDom.lastChild.classList.contains("resourceBox")) {
          MCE._history_insertElement(MCE._p(), MCE._contentDom, "in");
        }
  
        // 向客户端发送当前字数数据
        MCE._sendClientMessage_textLength();
      }
  
      // 向客户端发送当前是否显示保存按钮
      MCE._sendClientMessage("canSave", {
        can: MCE._contentDom.children.length > 1 || MCE._contentDom.children[0].children.length > 1
      });
    }
  
    MCE._onCompositionstart = function (e) {
      MCE.DEBUGER && console.log("onCompositionstart", e);
      MCE._cpLock = true;
      if(!MCE._compositionDom) {
        MCE._compositionDom = document.createElement("ss");
        MCE._compositionDom.id = "composition";
      }
      MCE._insertAfter(MCE._compositionDom, MCE._cursorNode);
    }
  
    MCE._onCompositionupdate = function(e) {
      MCE.DEBUGER && console.log("_onCompositionupdate", e);
      if(e.data) {
        MCE._compositionDom.innerHTML = e.data;
        MCE._setCursor(MCE._compositionDom);
        MCE._onInput.call(MCE._contentDom);
      }
    }
  
    MCE._onCompositionend = function (e) {
      MCE.DEBUGER && console.log("onCompositionend", e);
      if(MCE._cpLock) {
        MCE._setCursor(MCE._compositionDom.previousSibling);
        MCE._compositionDom.remove();
        MCE._cpLock = false;
        // 若在组合输入过程中，发生touch事件，则实际并不会结束组合输入
      }
    }
  
    // 主动结束中文文本输入
    MCE._compositionEnd = function() {
  
      // var evObj = document.createEvent('CompositionEvent');
      // evObj.initCompositionEvent("compositionend", true, true, window, MCE._compositionDom.innerText, "");
      // MCE._virtualInput.dispatchEvent(evObj);
  
      // 目前测试结果，能强行结束组合输入的事件，只有blur事件，其它事件都不行。。
      MCE._virtualInput.blur();
      MCE._virtualInput.focus();
  
      return false;
    }
  
    MCE.getCursorStyle = function () {
      return MCE._textStyle;
    }
  
    MCE.focus = function () {
      if (MCE._contentDom) {
        return MCE._setCursor(MCE._contentDom.lastChild.lastChild);
      }
    }
  
    MCE.blur = function () {
      // 在输入组合词状态时，失去焦点事件会失效，因为失去焦点时，会马上触发输入事件
      // 此处先让输入框失去焦点，相当于主动触发一次组合词输入结束事件
      // 在输入事件执行完成后，再调用一次blur
      // 在组合输入状态时，要失去焦点要执行两次，第一次为了触发组合词输入结束事件，第二次才是真正失去焦点
      if(MCE._cpLock) {
        MCE._virtualInput.blur();
        setTimeout(function(){
          MCE.blur();
        }, 100);
        return;
      }
      MCE._sendClientMessage("blur", {});
      MCE._virtualInput.blur();
      document.activeElement.blur();
      MCE._removeCursor();
    }
  
    MCE._onFocus = function (e) {
      MCE.DEBUGER && console.log("_onFocus");
      MCE._virtualInputFocus = true;
      MCE._sendClientMessage("focus", {});
    }
  
    MCE._onBlur = function (e) {
      MCE.DEBUGER && console.log("_onBlur");
      MCE._virtualInputFocus = false;
    }
  
    MCE.onTouchstart = function (e) {
      MCE.DEBUGER && console.log("onTouchstart", e);
      if(MCE._touches && MCE._touches.length > 0) { // 禁用多指触摸
        return false;
      }
      if (!MCE._canEdit || MCE._editingAudio) {
        return false;
      }
      if(MCE._cpLock) {
        return MCE._compositionEnd();
      }
      MCE.dscroll.scrollStop = true;
      MCE._touches = [e];
      if(e.target.parentElement && e.target.parentElement.classList.contains("menus")) {
        // 长按菜单
  
      } else {
        if (e.target.classList.contains("audio") && e.target.id == MCE._playingAudio) {
          // 音频进度条
          var px = e.touches[0].clientX - e.target.offsetLeft,
            py = e.touches[0].clientY - e.target.offsetTop;
          if (px > MCE._config.audioProgressBar.left && px < MCE._config.audioProgressBar.right) {
            MCE._playAudioCache[MCE._playingAudio].status = 3;
          }
        } else if(e.target == MCE._selectControllerStart || e.target == MCE._selectControllerEnd) {
          // 选择控制器
          MCE._selectingController = e.target;
          MCE.DEBUGER && console.log("_selectingController");
        } else {
          // 长按事件
          MCE.touchlongTimer = setTimeout(MCE.onTouchlong, MCE._config.touchlongTime);
          MCE._selectingController = null;
        }
        MCE._hideOperationMenu();
  
        // 移除元素的选中状态
        if(MCE._cursorNode && !e.target.classList.contains("selected") && !MCE._selectingController) {
          MCE._cancelSelectedContent();
        }
      }
  
      return true;
    }
  
    MCE.onTouchmove = function (e) {
      // console.log("onTouchmove",e.touches[0].clientX,e.touches[0].clientY);
      var _clientX = Math.abs(e.touches[0].clientX - MCE._touches[MCE._touches.length-1].touches[0].clientX);
      var _clientY = Math.abs(e.touches[0].clientY - MCE._touches[MCE._touches.length-1].touches[0].clientY);
      if( _clientX + _clientY < 2 ) return false;      //p20  触摸时没有移动也会触发onTouchmove
      MCE.touchlongTimer && clearTimeout(MCE.touchlongTimer);
  
      if (!MCE._canEdit || MCE._editingAudio) {
        return false;
      }
      // 操作菜单出现时，禁止拖动
      if(parseInt(MCE._operationMenu.style.left) > 0) {
        return false;
      }
  
      MCE._touches.push(e);
  
      // 拖拽音频播放进度条
      if (MCE._playingAudio && MCE._playAudioCache[MCE._playingAudio].status == 3) {
        var audio = MCE._touches[0].target;
        var px = e.touches[0].clientX - audio.offsetLeft - MCE._config.audioProgressBar.left;
        px = Math.max(Math.min(px, MCE._config.audioProgressBar.width), 0);
        MCE._playAudioCache[MCE._playingAudio].time = px / MCE._config.audioProgressBar.width * parseInt(audio.getAttribute("data-duration"));
        MCE.DEBUGER && console.log(MCE._playAudioCache[MCE._playingAudio].time);
        MCE.renderAudio(audio);
        return false;
      }
  
      // 拖拽选中
      if(MCE._selectingController) {
        var target = MCE._trueSearchContentFromPoint({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        });
        if(target != MCE._selectingController) {
          if(MCE._selectingController == MCE._selectControllerStart) {
            MCE._selectContent(target, MCE._selectedEndNode);
          } else {
            MCE._selectContent(MCE._selectedStartNode, target);
          }
        }
        return false;
      }
      return true;
    }
  
    MCE.onTouchend = function (e) {
      if (!MCE._canEdit || MCE._editingAudio) {
        return false;
      }
      MCE.touchlongTimer && clearTimeout(MCE.touchlongTimer);
      if(MCE._touches && MCE._touches.length > 0 && e) {
        MCE.DEBUGER && console.log("onTouchend", e);
        if (MCE._touches.length < 3 && (MCE._touches[0].target == MCE._touches[MCE._touches.length - 1].target)) {
            MCE.onClick(MCE._touches[0]);
        } else {
          // 音频从新的位置开始播放
          if (MCE._playingAudio && MCE._playAudioCache[MCE._playingAudio].status == 3) {
            MCE.pauseAudio();
            MCE._sendClientMessage("playAudio", {
              id: MCE._touches[0].target.getAttribute("data-id"),
              domId: MCE._touches[0].target.id,
              start: MCE._playAudioCache[MCE._playingAudio].time
            });
          }
          if(MCE._selectingController) {
            MCE._showOperationMenu();
          }
        }
      }
  
      MCE._touches = [];
      return true;
    }
  
    MCE.onClick = function(e) {
      var target = e.target;
  
      // 长按菜单
      if(target.parentElement && target.parentElement.classList.contains("menus")) {
        MCE.DEBUGER && console.log("operationMenu", target.innerText);
        switch(target.innerText) {
          case "选择":
            if(MCE._cursorNode) {
              MCE._selectContent(MCE._cursorNode);
              MCE._showOperationMenu();
            }
          break;
          case "全选":
            MCE.selectAllContent();
          break;
          case "剪切":
            MCE._insertHistory();
            MCE._copySelectedContent();
            MCE._deleteSelectedContent();
          break;
          case "复制":
            MCE._copySelectedContent();
          break;
          case "粘贴":
            MCE._paste(MCE._clipboardContent || "");
          break;
          case "删除":
            MCE._insertHistory();
            MCE._backDelete();
          break;
        }
        return;
      }
  
      var targetOffset = MCE._getOffsetOfDocument(target);
      var px = e.touches[0].clientX - targetOffset.x,
        py = e.touches[0].clientY + MCE._contentDom.y - targetOffset.y;
  
      // 任务状态变更
      if (target.classList.contains("list") && target.classList.contains("task")) {
        if (px < MCE._config.listContentPadding && py < MCE._config.lineHeight) {
          if(target.classList.contains("tasked")) {
            MCE._history_removeClassName(target, "tasked");
          } else {
            MCE._history_addClassName(target, "tasked");
          }
          return;
        }
      }
  
      // 播放音频
      if (target.classList.contains("audio")) {
        var aid = target.getAttribute("data-id");
        MCE.DEBUGER && console.log(px, py);
        if (px < MCE._config.audioHeight && py < MCE._config.audioHeight) { // 点中了播放按钮
          if (MCE._playingAudio && target.id == MCE._playingAudio) {
            if (MCE._playAudioCache[MCE._playingAudio].status == 1) {
              MCE.pauseAudio();
            } else {
              MCE._sendClientMessage("playAudio", {
                id: aid,
                domId: target.id,
                start: MCE._playAudioCache[MCE._playingAudio].time
              });
            }
          } else {
            MCE.pauseAudio();
            MCE._sendClientMessage("playAudio", {
              id: aid,
              domId: target.id,
              start: 0
            });
          }
        } else if (MCE._playingAudio) { // 点中了进度条
          if (px > MCE._config.audioProgressBar.left && px < MCE._config.audioProgressBar.right) {
            MCE._sendClientMessage("playAudio", {
              id: aid,
              domId: target.id,
              start: (px - MCE._config.audioProgressBar.left) / MCE._config.audioProgressBar.width * parseInt(target.getAttribute("data-duration"))
            });
          }
        }
        return;
      }
  
      // 播放视频
      if (target.classList.contains("video")) {
        var id = target.getAttribute("data-id");
        MCE._sendClientMessage("playVideo", {
          id: id,
          index: MCE.getResourceIndexForIAV(target.id)
        });
        return;
      }
  
      // 播放图片
      if (target.classList.contains("image")) {
        var id = target.getAttribute("data-id");
        MCE._sendClientMessage("playImage", {
          id: id,
          index: MCE.getResourceIndexForIAV(target.id)
        });
        return;
      }
  
      // 设置焦点
      MCE._setCursorOnTouchTarget(target, e.touches[0].clientX, e.touches[0].clientY);
    }
  
    MCE.selectAllContent = function() {
      if(MCE._contentDom.innerText.length == 0 && document.getElementsByClassName("resource").length == 0) {
        return false;
      }
  
      var firstChild, ft = MCE._contentDom.firstChild;
      while(ft && ft.innerText.length == 0 && !ft.classList.contains("resourceBox")) {
        ft = ft.nextSibling;
      }
      if(ft && (ft.innerText.length > 0 || ft.classList.contains("resourceBox"))) firstChild = ft.children[1];
      else return false;
  
      var lastChild, lt = MCE._contentDom.lastChild;
      while(lt && lt.innerText.length == 0 && !lt.classList.contains("resourceBox")) {
        lt = lt.previousSibling;
      }
      if(lt && (lt.innerText.length > 0 || lt.classList.contains("resourceBox"))) lastChild = lt.lastChild;
      else return false;
      
      MCE._selectContent(firstChild, lastChild);
      MCE._showOperationMenu();
    }
  
    MCE._setCursorOnTouchTarget = function(target, clientX, clientY){
      MCE.DEBUGER && console.log("_setCursorOnTouchTarget", clientX, clientY);
      var targetOffset = MCE._getOffsetOfDocument(target);
      if (target.nodeName.toLowerCase() == "ss" || (target.nodeName.toLocaleLowerCase() == "canvas" && target.classList.contains("resource"))) {
        MCE._setCursor(target, clientX < targetOffset.x + target.offsetWidth / 2);
        return true;
      } else if (target.nodeName.toLowerCase() == "p") {
        if (!(target.classList.contains("task") && clientX < MCE._config.listContentPadding && clientY - (target.offsetTop + MCE._contentDom.y) < MCE._config.lineHeight)) {
          if(target.classList.contains("resourceBox")) {
            MCE._setCursor(target.getElementsByClassName("resource")[0], clientX < window.innerWidth / 2);
          } else {
            // 查询最近的可点击元素
            // 从当前点击位置开始，向左右两侧以2像素为间距扩展，直到扩展到P边界或找到某元素为止
            var ptargetScreenY = MCE._getOffsetOfDocument(target).y + MCE._contentDom.y;
            clientY = (Math.floor((clientY - ptargetScreenY) / MCE._config.lineHeight) + 0.5) * MCE._config.lineHeight + ptargetScreenY; // 修正y
            var t = MCE._searchContentElementFromPoint({
              x: clientX,
              y: clientY
            }) || target.lastChild;
            MCE._setCursor(t, clientX < MCE._getOffsetOfDocument(t).x + t.offsetWidth / 2);
          }
          return true;
        }
      } else if (target == MCE._contentDom || target == document.getElementById("layout") || target == document.body || target == document.documentElement) {
        var contentNode = MCE._trueSearchContentFromPoint({
          x: clientX,
          y: clientY
        });
        MCE._setCursor(contentNode, clientX < MCE._getOffsetOfDocument(contentNode).x + contentNode.offsetWidth / 2);
        return true;
      }
      return false;
    }
  
    MCE._trueSearchContentFromPoint = function(point) {
      var t = MCE._searchContentParagraphFromPoint({
        x: point.x,
        y: point.y
      });
      if(!t) {
        t = {
          target: MCE._contentDom.lastChild,
          y: MCE._getOffsetOfDocument(MCE._contentDom.lastChild).y + MCE._config.lineHeight / 2
        };
      }
      var ptargetScreenY = MCE._getOffsetOfDocument(t.target).y + MCE._contentDom.y
      t.y = (Math.floor((t.y - ptargetScreenY) / MCE._config.lineHeight) + 0.5) * MCE._config.lineHeight + ptargetScreenY; // 修正y
      var t2 = MCE._searchContentElementFromPoint({
        x: point.x,
        y: t.y
      }) || t.target.lastChild;
      return t2;
    }
  
    MCE._searchContentParagraphFromPoint = function(point){
      var uy = point.y,
      dy = point.y;
      var target;
      while(true) {
        if(uy !== false && uy > 0) {
          if((target = MCE._getContentParagraphFromPoint(point.x, uy))) {
            return {
              target: target,
              y: uy
            };
          }
          uy -= 2;
        } else {
          uy = false;
        }
        if(dy !== false && dy < window.innerHeight) {
          if((target = MCE._getContentParagraphFromPoint(point.x, dy))) {
            return {
              target: target,
              y: dy
            };
          }
          dy += 2;
        } else {
          dy = false;
        }
        if(!uy && !dy) {
          return null;
        }
      }
    }
  
    MCE._getContentParagraphFromPoint = function(x, y) {
      var target = document.elementFromPoint(x, y);
      if(target && (target.nodeName.toLowerCase() == "p")) {
        return target;
      }
      if(target && (target.nodeName.toLowerCase() == "ss" || target.nodeName.toLowerCase() == "canvas")) {
        return target.parentElement;
      }
      return null;
    }
  
    // 从点击位置查询内容元素 向左右查询
    // @point         点击的点 基于屏幕位置
    MCE._searchContentElementFromPoint = function(point) {
      var rx = point.x,
        lx = point.x;
      var target;
      while (true) {
        if(rx !== false && rx < window.innerWidth) {
          if((target = MCE._getContentElementFromPoint(rx, point.y))) {
            return target;
          }
          rx += 2;
        } else {
          rx = false;
        }
        if(lx !== false && lx > 0) {
          if((target = MCE._getContentElementFromPoint(lx, point.y))) {
            return target;
          }
          lx -= 2;
        } else {
          lx = false;
        }
        if(!rx && !lx) {
          return null;
        }
      }
      return null;
    }
  
    MCE._getContentElementFromPoint = function(x, y){
      var target = document.elementFromPoint(x, y);
      if(target && (target.nodeName.toLowerCase() == "ss" || target.nodeName.toLowerCase() == "canvas")) {
        return target;
      }
      return null;
    }
  
    MCE.onTouchlong = function() {
      if(MCE._cursorNode && MCE._touches && MCE._touches.length > 0) {
        MCE.DEBUGER && console.log("onTouchlong");
        var e = MCE._touches[0];
        var target = e.target;
  
        MCE._operationMenu.style.left = "2000px"; // 预置操作菜单
        MCE._setCursorOnTouchTarget(target, e.touches[0].clientX, e.touches[0].clientY);
        setTimeout(function(){ // 长按菜单延时显示 在非编辑状态时，要等待键盘完全弹出来再显示菜单
          if(MCE._cursorNode.classList.contains("resource") && !MCE._cursorNode.classList.contains("selected")) {
            MCE._selectContent(MCE._cursorNode);
            MCE._showOperationMenu();
          } else {
            MCE._sendClientMessage("getClipboard", {});
          }
        }, 300);
      }
      MCE._touches = [];
    }
  
    MCE.setClipboardContent = function(text) {
      MCE.DEBUGER && console.log("setClipboardContent", text);
      MCE._clipboardContent = text || "";
      MCE._showOperationMenu();
    }
  
    MCE.onPaste = function (e) {
      MCE.DEBUGER && console.log("onPaste", e);
      e.preventDefault(); //可以阻止默认粘贴
      var text = (e.originalEvent || e).clipboardData.getData('text/plain');
      MCE.DEBUGER && console.log(text);
    }
  
    MCE.onResize = function(e) {
      // if(MCE._operationMenu.style.left != "-1000px") MCE._showOperationMenu();
      MCE.DEBUGER && console.log("onResize", window.innerWidth, window.innerHeight);
      if(!MCE._save) {   //如果点保存按钮  就不显示OperationMenu
        setTimeout(function() {
          MCE._showOperationMenu();
        }, 500);
      }
      // MCE.onResizeTimer && clearTimeout(MCE.onResizeTimer);
      // MCE.onResizeTimer = setTimeout(function() {
      MCE._scrollToCursor();
      // }, 500);
    }
  
    // 发送客户端事件
    MCE._sendClientMessage = function (event, data) {
      try {
        MCE.DEBUGER && console.log(event, data);
        window.jsbridge && window.jsbridge[event] && window.jsbridge[event](JSON.stringify(data));
        window.webkit.messageHandlers[event].postMessage(data);
      } catch (e) { }
    }
  
    MCE._sendClientMessage_historyStatus = function(){
      
      MCE._sendClientMessage("history", {
        canUndo: MCE._canEdit && !MCE._editingAudio && !!MCE._history && MCE._historyIndex >= 0,
        canRedo: MCE._canEdit && !MCE._editingAudio && !!MCE._history && MCE._historyIndex < MCE._history.length - 1
      });
    }
  
    MCE._sendClientMessage_textLength = function(){
      MCE._sendClientMessage("textLength", {
        length: MCE._contentDom.innerText.trim().replace(/\n/g, '').length
      });
    }
  
    MCE._selectContent = function(startNode, endNode) {
      startNode = startNode || MCE._cursorNode;
      endNode = endNode || startNode;
      var startNodeOffset = MCE._getOffsetOfDocument(startNode),
      endNodeOffset = MCE._getOffsetOfDocument(endNode);
      if(startNodeOffset.y > endNodeOffset.y) {
        return;
      }
      if(startNodeOffset.y == endNodeOffset.y && startNodeOffset.x > endNodeOffset.x) {
        return;
      }
      MCE._cancelSelectedContent(startNode, endNode);
      MCE._selectedStartNode = startNode;
      MCE._selectedEndNode = endNode;
      MCE._cursorNodeLocation = false;
      // 隐藏光标
      MCE._setCursorHidden(true);
      // 为目标设置选中样式
      var t = startNode;
      var nodeName;
      while(t) {
        nodeName = t.nodeName.toLowerCase();
        if(nodeName == "p") {
          t = t.firstChild;
          nodeName = "ss";
        }
        if(t) {
          if(!t.classList.contains("selected")) {
            t.classList.add("selected");
            if(nodeName == "canvas") {
              MCE._renderResource(t);
            }
          }
        }
        if(t == endNode) {
          break;
        }
        if(!t.nextSibling && (nodeName == "ss" || nodeName == "canvas")) {
          t = t.parentElement.nextSibling;
        } else {
          t = t.nextSibling;
        }
      }
  
      MCE._updateSelectController(startNode, endNode);
  
      // 检测当前选中的内容样式
      var selecteds = document.getElementsByClassName("selected");
      var selectedStyle = MCE._getNodeStyle(selecteds[0]);
      for(var i = 1; i < selecteds.length; ++i) {
        var nodeStyle = MCE._getNodeStyle(selecteds[i]);
        if(selectedStyle.bold && !nodeStyle.bold) {
          selectedStyle.bold = false;
        }
        if(selectedStyle.italic && !nodeStyle.italic) {
          selectedStyle.italic = false;
        }
        if(selectedStyle.underline && !nodeStyle.underline) {
          selectedStyle.underline = false;
        }
        if(selectedStyle.align != "none" && nodeStyle.align != selectedStyle.align) {
          selectedStyle.align = "none";
        }
        if(!selectedStyle.bold && !selectedStyle.italic && !selectedStyle.underline && selectedStyle.align == "none") {
          break;
        }
      }
      MCE._textStyle = selectedStyle;
      MCE._sendClientMessage("textStyle", MCE._textStyle);
    }
  
    MCE._deleteSelectedContent = function() {
      var selected = document.getElementsByClassName("selected");
      if(selected.length > 0) {
        MCE._insertHistory();
  
        var sp = MCE._selectedStartNode.parentElement;
        var ep = MCE._selectedEndNode.parentElement;
        var spp = sp.previousSibling;
        var epn = ep.nextSibling;
        var vhead = document.createElement("div");
        var vbody = document.createElement("div");
        var vfoot = document.createElement("div");
        
        // 将要操作的元素取出来，放到虚拟元素中，在虚拟元素中操作删除
        MCE._selectedStartNode.classList.add("rcs");
        MCE._selectedEndNode.classList.add("rce");
        var tt = sp;
        while(true) {
          vbody.appendChild(tt.cloneNode(true));
          if(tt == ep) break;
          tt = tt.nextSibling;
        }
        // 取头尾字符
        var vsp = vbody.firstChild;
        var vep = vbody.lastChild;
        if(!vsp.classList.contains("resourceBox")) {
          while(true) {
            if(vsp.firstChild.classList.contains("rcs")) break;
            vhead.appendChild(vsp.firstChild);
          }
        }
        if(!vep.classList.contains("resourceBox")) {
          while(true) {
            if(!vep.getElementsByClassName("rce")[0].nextSibling) break;
            vfoot.appendChild(vep.getElementsByClassName("rce")[0].nextSibling);
          }
        }
        vsp.getElementsByClassName("rcs")[0].classList.remove("rcs");
        vep.getElementsByClassName("rce")[0].classList.remove("rce");
        // 插入历史记录
        MCE._insertHistoryStep("removeContent", null, {
          startElement: MCE._selectedStartNode.cloneNode(true),
          endElement: MCE._selectedEndNode.cloneNode(true),
          spp: spp && spp.cloneNode(true),
          epn: epn && epn.cloneNode(true),
          vhead: vhead,
          vbody: vbody,
          vfoot: vfoot
        });
        // 输出到正式DOM
        var ncn = null, ncnp = false;
        if(sp == ep) {
          if(sp.classList.contains("resourceBox")) {
            sp.remove();
          } else {
            sp.innerHTML = vhead.innerHTML + vfoot.innerHTML;
            ncn = document.getElementById(vhead.lastChild.id);
          }
        } else {
          for(var i = 0; i < vbody.children.length; ++i) {
            if(vbody.children[i].classList.contains("resourceBox")) {
              document.getElementById(vbody.children[i].id).remove();
            } else {
              if(i == 0) {
                if(MCE._selectedStartNode == sp.firstChild || MCE._selectedStartNode == sp.children[1]) {
                  document.getElementById(vbody.children[i].id).remove();
                } else {
                  sp.innerHTML = vhead.innerHTML;
                  ncn = sp.lastChild;
                }
              } else if(i == vbody.children.length - 1) {
                if(MCE._selectedEndNode == ep.lastChild) {
                  document.getElementById(vbody.children[i].id).remove();
                } else {
                  ep.innerHTML = vfoot.innerHTML;
                  ncn = ep.firstChild;
                  ncnp = true;
                }
              } else {
                document.getElementById(vbody.children[i].id).remove();
              }
            }
          }
        }
  
        MCE._onInput.call(MCE._contentDom);
        if(!ncn) {
          if(spp) ncn = spp.lastChild;
          else if(epn) ncn = epn.firstChild;
          else ncn = MCE._contentDom.firstChild && MCE._contentDom.firstChild.firstChild;
        }
        if(ncn) {
          MCE._setCursor(ncn, ncnp);
          MCE._updateLastHistoryStepCursor();
        }
        MCE._cancelSelectedContent();
        return true;
      }
      return false;
    }
  
    MCE._paste = function(text) {
      MCE._insertHistory();
      var selected = document.getElementsByClassName("selected");
      if(selected.length > 0) {
        MCE._deleteSelectedContent();
      }
      if(text) {
        try {
          var mcCopyData = JSON.parse(text);
          var element;
          for(var i = 0; i < mcCopyData.length; ++i) {
            switch(mcCopyData[i].type) {
              case "image":
              element = MCE.insertImage(mcCopyData[i].id, "", mcCopyData[i].width, mcCopyData[i].height);
              break;
              case "audio":
              element = MCE.insertAudio(mcCopyData[i].id, mcCopyData[i].duration);
              break;
              case "video":
              element = MCE.insertVideo(mcCopyData[i].id, "", mcCopyData[i].width, mcCopyData[i].height, mcCopyData[i].duration);
              break;
              case "newline":
              element = MCE.newLine().firstChild;
              break;
              case "string":
              var ss = MCE._ss(mcCopyData[i].text);
              if(mcCopyData[i].style.indexOf("b") > -1) {
                ss.style.fontWeight = "bold";
              }
              if(mcCopyData[i].style.indexOf("i") > -1) {
                ss.style.fontStyle = "italic";
              }
              if(mcCopyData[i].style.indexOf("u") > -1) {
                ss.style.textDecoration = "underline";
              }
              MCE._history_insertElement(ss, MCE._cursorNode, MCE._cursorNodeLocation ? "before" : "after");
              element = ss;
              break;
            }
            MCE._setCursor(element, false);
          }
        } catch(e) {
          MCE.insertText(text);
        }
      }
      MCE._hideOperationMenu();
      MCE._onInput.call(MCE._contentDom);
      return true;
    }
  
    MCE._copySelectedContent = function(){
      var selected = document.getElementsByClassName("selected");
      if(selected.length > 0) {
        var copyDom = document.createElement("div");
        var mcData = [];
        var p = selected[0].parentElement;
        for(var i = 0; i < selected.length; ++i) {
          switch(selected[i].nodeName.toLocaleLowerCase()) {
            case "canvas":
              var resourceData = {
                type: MCE._getResourceType(selected[i]),
                id: selected[i].getAttribute("data-id")
              };
              if(resourceData.type == "image" || resourceData.type == "video") {
                resourceData.width = selected[i].getAttribute("data-imagewidth");
                resourceData.height = selected[i].getAttribute("data-imageheight");
              }
              if(resourceData.type == "audio" || resourceData.type == "video") {
                resourceData.duration = selected[i].getAttribute("data-duration");
              }
              mcData.push(resourceData);
            break;
            case "ss":
              if(selected[i].innerText) {
                if(p != selected[i].parentElement) {
                  mcData.push({
                    type: "newline"
                  });
                  p = selected[i].parentElement;
                }
                var nodeStyle = MCE._getNodeStyle(selected[i]);
                mcData.push({
                  type: "string",
                  text: selected[i].innerText,
                  style: (nodeStyle.bold ? "b" : "") + (nodeStyle.italic ? "i" : "") + (nodeStyle.underline ? "u" : "")
                });
                copyDom.appendChild(selected[i].cloneNode(true));
              }
            break;
          }
        }
        MCE._sendClientMessage("copy", {
          data: copyDom.innerText,
          mcData: JSON.stringify(mcData)
        });
        MCE._hideOperationMenu();
        return true;
      }
      return false;
    }
  
    MCE._cancelSelectedContent = function(startNode, endNode) {
      var selecteds = document.getElementsByClassName("selected");
      if(startNode) {
        var i = selecteds.length - 1;
        var startNodeOffset = MCE._getOffsetOfDocument(startNode);
        var endNodeOffset = MCE._getOffsetOfDocument(endNode);
        var nodeOffset;
        while(i > -1) {
          if(selecteds[i] != startNode && selecteds[i] != endNode) {
            nodeOffset = MCE._getOffsetOfDocument(selecteds[i]);
            if((nodeOffset.y < startNodeOffset.y)
              || (nodeOffset.x < startNodeOffset.x && nodeOffset.y == startNodeOffset.y)
              || nodeOffset.y > endNodeOffset.y
              || (nodeOffset.x > endNodeOffset.x && nodeOffset.y == endNodeOffset.y)) {
                MCE._removeNodeSelectedStatus(selecteds[i]);
            }
          }
          i--;
        }
      } else {
        var i = selecteds.length - 1;
        while(i > -1) {
          MCE._removeNodeSelectedStatus(selecteds[i]);
          i--;
        }
        MCE._setCursorHidden(false);
        MCE._selectedStartNode = null;
        MCE._selectedEndNode = null;
        MCE._hideOperationMenu();
        MCE._resetSelectController();
      }
    }
  
    MCE._removeNodeSelectedStatus = function(node){
      node.classList.remove("selected");
      if(node.classList.contains("resource")) {
        MCE._renderResource(node);
      }
    }
  
    MCE._updateSelectController = function(startNode, endNode) {
      MCE._selectControllerStartNode = startNode || MCE._selectControllerStartNode;
      MCE._selectControllerEndNode = endNode || MCE._selectControllerEndNode;
      if(!MCE._selectControllerStartNode || !MCE._selectControllerEndNode) {
        return false;
      }
  
      var startOffset = MCE._getOffsetOfDocument(MCE._selectControllerStartNode);
      MCE._selectControllerStart.style.left = startOffset.x - 25 + "px";
      MCE._selectControllerStart.style.top = startOffset.y + (MCE._contentDom.y || 0) - 10 + "px";
      var height = (MCE._selectControllerStartNode.offsetHeight + 10) * 2;
      if(height != MCE._selectControllerStart.height) {
        MCE._selectControllerStart.height = height;
        MCE._selectControllerStartCTX.clearRect(0, 0, MCE._selectControllerStart.width, MCE._selectControllerStart.height);
        MCE._selectControllerStartCTX.fillStyle = "#fbb03b";
        MCE._selectControllerStartCTX.arc(50, 10, 10, 0, Math.PI * 2);
        MCE._selectControllerStartCTX.fill();
        MCE._selectControllerStartCTX.fillRect(48, 20, 4, MCE._selectControllerStartNode.offsetHeight * 2);
      }
  
      var endOffset = MCE._getOffsetOfDocument(MCE._selectControllerEndNode);
      MCE._selectControllerEnd.style.left = endOffset.x + MCE._selectControllerEndNode.offsetWidth - 6 + "px";
      MCE._selectControllerEnd.style.top = endOffset.y + (MCE._contentDom.y || 0) + "px";
      height = (MCE._selectControllerEndNode.offsetHeight + 10) * 2;
      if(height != MCE._selectControllerEnd.height) {
        MCE._selectControllerEnd.height = height;
        MCE._selectControllerEndCTX.clearRect(0, 0, MCE._selectControllerEnd.width, MCE._selectControllerEnd.height);
        MCE._selectControllerEndCTX.fillStyle = "#fbb03b";
        MCE._selectControllerEndCTX.arc(10, (MCE._selectControllerEndNode.offsetHeight + 5) * 2, 10, 0, Math.PI * 2);
        MCE._selectControllerEndCTX.fill();
        MCE._selectControllerEndCTX.fillRect(8, 0, 4, MCE._selectControllerEndNode.offsetHeight * 2);
      }
    }
  
    MCE._resetSelectController = function() {
      if(!MCE._selectControllerStart) {
        MCE._selectControllerStart = document.createElement("canvas");
        MCE._selectControllerStart.style.position = "absolute";
        MCE._selectControllerStart.style.width = "30px";
        MCE._selectControllerStart.width = 60;
        MCE._selectControllerStart.height = 20;
        MCE._selectControllerStartCTX = MCE._selectControllerStart.getContext("2d");
        document.getElementById("layout").appendChild(MCE._selectControllerStart);
        MCE._selectControllerEnd = document.createElement("canvas");
        MCE._selectControllerEnd.style.position = "absolute";
        MCE._selectControllerEnd.style.width = "30px";
        MCE._selectControllerEnd.width = 60;
        MCE._selectControllerEnd.height = 20;
        MCE._selectControllerEndCTX = MCE._selectControllerEnd.getContext("2d");
        document.getElementById("layout").appendChild(MCE._selectControllerEnd);
      }
      MCE._selectControllerStartNode = null;
      MCE._selectControllerEndNode = null;
      MCE._selectControllerStart.style.left = "-1000px";
      MCE._selectControllerEnd.style.left = "-1000px";
    }
  
    // 插入文字
    MCE.insertText = function (text, notCursor, firstCharId, lastCharId) {
      MCE.touchlongTimer && clearTimeout(MCE.touchlongTimer);
      MCE.DEBUGER && console.log("insertText", text);
      if(!text) {
        return false;
      }
      if(MCE.getContentHeight() >= MCE._config.maxContentHeight) {
        MCE._sendClientMessage("showError", {
          text: MCE._config.maxContentHeight_errorText
        });
        return false;
      }
      var time = Date.now();
      MCE._deleteSelectedContent();
      text = text.replace(/&quot;/ig, '"');
      text = text.replace(/&amp;/ig, "&");
      text = text.replace(/&lt;/ig, "<");
      text = text.replace(/&gt;/ig, ">");
      text = text.replace(/&nbsp;/ig, " ");
      text = text.replace(/&apos;/ig, "'");
      var cp = MCE._cursorNode.parentElement;
      if(cp.classList.contains("resourceBox")) {
        var p = MCE._cursorNodeLocation ? cp.previousSibling : cp.nextSibling;
        if(!p || p.classList.contains("resourceBox")) {
          p = MCE._p();
          MCE._history_insertElement(p, cp, MCE._cursorNodeLocation ? "before" : "after");
        }
        MCE._cursorNode = MCE._cursorNodeLocation ? p.lastChild : p.firstChild;
        MCE._cursorNodeLocation = MCE._cursorNode == p.firstChild ? false : !MCE._cursorNodeLocation;
        MCE._updateLastHistoryStepCursor();
        cp = p;
      }
      // MCE.DEBUGER && console.log("insertTextTime1", Date.now() - time);
      // time = Date.now();
      var c1, c1c, c2, c2c, ss;
      MCE._cursorNode.classList.add("itpn");
      var textHtmlBox = cp.cloneNode(true);
      var beforeNode = textHtmlBox.getElementsByClassName("itpn")[0];
      if(MCE._cursorNodeLocation) beforeNode = beforeNode.previousSibling;
      var idn, isUUID;
      if(firstCharId) {
        idn = /\d+/ig.exec(firstCharId);
        isUUID = false;
      }
      else {
        idn = ++MCE._autoUUID;
        isUUID = true;
      }
      var emojiLinkFlag = false;
      var emojiLetter = false;
      for (var i = 0; i < text.length; ++i) {
        c1 = text.slice(i, i + 1);
        c1c = c1.charCodeAt(0);
        if(c1c == 10461 || c1c == 10311) { // 兼容旧数据待办事例
          cp.classList.add("list");
          cp.classList.add("task");
          if(c1c == 10311) cp.classList.add("tasked");
          continue;
        }
        if(c1c == 8205) { // emoji 连接符
          emojiLinkFlag = true;
        } else if(c1c >= 0xd83c && c1c <= 0xd83e) { // 大emoji表情起始符
          c2 = text.slice(i + 1, i + 2);
          c2c = c2.charCodeAt(0);
          if(c2c == 57339 || c2c == 57340 || c2c == 57341 || c2c == 57342 || c2c == 57343) {
            // 颜色emoji
            emojiLinkFlag = true;
            emojiLetter = false;
          } else if(c2c >= 56806 && c2c <= 56831) {
            // 国旗字母emoji
            if(emojiLetter) emojiLinkFlag = true;
            else emojiLetter = true;
          } else {
            emojiLetter = false;
          }
          c1 = text.slice(i, i + 2);
          i++;
        } else if(c1c == 56128) {
          // 某些特殊的国家国旗后面跟着一堆这个，也不知道干什么用的，先连接上。。
          c1 = text.slice(i, i + 2);
          i++;
          emojiLinkFlag = true;
        } else if(c1c == 9794 || c1c == 9792) {
          // 性别符号
          emojiLinkFlag = true;
        } else if(c1c == 65039) {
          // 组合结束符
          emojiLinkFlag = true;
        }
  
        if(emojiLinkFlag) { // 连接emoji表情
          beforeNode.innerHTML = beforeNode.innerHTML + c1;
          emojiLinkFlag = false;
          continue;
        }
  
        ss = MCE._ss(c1, "i" + idn);
        MCE._insertAfter(ss, beforeNode);
        beforeNode = ss;
        idn++;
        if(!firstCharId) firstCharId = ss.id;
      }
      if(isUUID) {
        MCE._autoUUID = idn;
      }
      // MCE.DEBUGER && console.log("insertTextTime2", Date.now() - time);
      // time = Date.now();
      textHtmlBox.getElementsByClassName("itpn")[0].classList.remove("itpn");
      if(lastCharId) ss.id = lastCharId;
      else lastCharId = ss.id;
      cp.innerHTML = textHtmlBox.innerHTML;
  
      // MCE.DEBUGER && console.log("insertTextTime3", Date.now() - time);
      // time = Date.now();
      MCE._insertHistoryStep("insertText", null, {
        firstCharId: firstCharId,
        lastCharId: lastCharId,
        text: text,
        textStyle: MCE._textStyle
      });
      if (!notCursor) {
        MCE._setCursor(document.getElementById(lastCharId) || MCE._cursorNode);
      } else {
        MCE._onInput.call(MCE._contentDom);
      }
      MCE._updateLastHistoryStepCursor();
      MCE.DEBUGER && console.log("insertTextTime4", Date.now() - time);
      time = Date.now();
    }
  
    MCE.getAllText = function () {
      return MCE._contentDom.innerText.trim();
    }
  
    MCE._insertResource = function(canvas) {
      if(document.getElementById(canvas.id)) {
        return document.getElementById(canvas.id).parentElement;
      }
      if(MCE.getContentHeight() + canvas.height > MCE._config.maxContentHeight) {
        MCE._sendClientMessage("showError", {
          text: MCE._config.maxContentHeight_errorText
        });
        return false;
      }
      var p = MCE._p();
      p.classList.add("resourceBox");
      p.appendChild(canvas);
  
      var cp = MCE._cursorNode.parentElement;
      MCE._insertHistory();
      MCE._history_insertElement(p, cp, cp.innerText.length == 0 || cp.firstChild == MCE._cursorNode ? "before" : "after");
      MCE._onInput.call(MCE._contentDom);
      MCE._deleteSelectedContent();
      return p;
    }
  
    MCE._getResourceForId = function(id){
      var resources = [];
      var resourceEelements = document.getElementsByClassName("resource");
      for(var i = 0; i < resourceEelements.length; ++i) {
        if(resourceEelements[i].getAttribute("data-id") == id) {
          resources.push(resourceEelements[i]);
        }
      }
      return resources;
    }
  
    MCE._addImageCache = function(id, data, loadedCallback) {
      if(!MCE._imageCache[id]) {
        MCE._imageCache[id] = {
          data: data,
          obj: null
        }
        var image = new Image();
        image.onload = function(){
          MCE._imageCache[id].obj = image;
          if(loadedCallback) loadedCallback();
        };
        image.src = data;
      }
    }
  
    // 插入图像
    MCE.insertImage = function (id, imageData, imageWidth, imageHeight) {
      MCE.DEBUGER && console.log("insertImage", id, imageData, imageWidth, imageHeight);
  
      var image = document.createElement("canvas");
      image.classList.add("resource");
      image.classList.add("image");
      image.id = "i" + (++MCE._autoUUID);
      image.setAttribute("data-id", id);
      image.setAttribute("data-imageWidth", imageWidth);
      image.setAttribute("data-imageHeight", imageHeight);
  
      if(!MCE._insertResource(image)) {
        return false;
      }
  
      MCE.renderImage(id, imageData);
  
      MCE._onInput.call(MCE._contentDom);
      return image;
    }
  
    MCE.renderImage = function (imageId, imageData) {
      MCE.DEBUGER && console.log("renderImage", imageId, imageData);
      var images = MCE._getResourceForId(imageId),
        imageWidth = images[0].getAttribute("data-imageWidth"),
        imageHeight = images[0].getAttribute("data-imageHeight"),
        canvasWidth = MCE._resourceWidth,
        canvasHeight = canvasWidth / imageWidth * imageHeight,
        imageCache = MCE._imageCache[imageId];
      for(var i = 0; i < images.length; ++i) {
        images[i].width = canvasWidth;
        images[i].height = canvasHeight;
        images[i].ctx = images[i].getContext("2d");
      }
      if(!imageCache) {
        for(var i = 0; i < images.length; ++i) {
          images[i].ctx.fillStyle = "#EEEEEE";
          images[i].ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
        if(!imageData) {
          MCE._sendClientMessage("getImage", {
            id: imageId,
            type: 'image'
          });
        } else {
          MCE._addImageCache(imageId, imageData, function() {
            MCE.renderImage(imageId);
          });
        }
      } else {
        for(var i = 0; i < images.length; ++i) {
          images[i].ctx.drawImage(imageCache.obj, 0, 0, canvasWidth, canvasHeight);
        }
      }
  
      // 渲染选中状态
      for(var i = 0; i < images.length; ++i) {
        if(images[i].classList.contains("selected")) {
          images[i].ctx.fillStyle = MCE._config.selectedBackgroundColor;
          images[i].ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
      }
    }
  
    MCE.getAllImages = function () {
      var images = document.getElementsByClassName("image");
      var ids = [];
      for (var i = 0; i < images.length; ++i) {
        ids.push(images[i].getAttribute("data-id"));
      }
      return ids;
    }
  
    // 插入音频 使用canvas 因为是插入到编辑器里，如果使用普通布局的话，时长等文本是可编辑状态，这是不可接受的。
    MCE.insertAudio = function (id, duration, text) {
      MCE.DEBUGER && console.log("insertAudio", id, duration, text);
  
      var canvas = MCE.createAudio(id, duration);
      var p = MCE._insertResource(canvas);
      if(!p) {
        return false;
      }
      if(text) {
        MCE.insertAudioText(text);
      }
  
      MCE._onInput.call(MCE._contentDom);
  
      return canvas;
    }
  
    MCE.insertAudioText = function(ap, text) {
      var p;
      if(!ap.nextSibling.classList.contains("resourceBox") && ap.nextSibling.innerText.length == 0) {
        p = ap.nextSibling;
      } else {
        p = MCE._p();
        MCE._history_insertElement(p, ap, "after");
      }
      MCE._setCursor(p);
      MCE._updateLastHistoryStepCursor();
      if(text) {
        MCE.insertText(text);
        MCE._setCursor(p);
        MCE._updateLastHistoryStepCursor();
      }
      return p;
    }
  
    // 开始录音
    MCE.startAudio = function () {
      MCE.DEBUGER && console.log("startAudio");
      MCE.stopAudio();
      // MCE.setEditing(false);
      MCE._editingAudio = {};
      MCE._editingAudio.canvas = MCE.insertAudio("ea" + Date.now(), 1);
      MCE._editingAudio.p = MCE.insertAudioText(MCE._editingAudio.canvas.parentElement, "");
  
      if(!MCE._editingAudio) {
        // MCE.setEditing(true);
        return false;
      }
      MCE._editingAudio.satus = 1;
      MCE._historyListener = false;
      MCE._onBlur();
      return true;
    }
  
    // 更新录音对应文本
    MCE.updateAudioText = function (text) {
      MCE.DEBUGER && console.log("updateAudioText", text);
      if (!MCE._editingAudio) {
        MCE.DEBUGER && console.log("No Editing Audio");
        return false;
      }
      if(!text) {
        return false;
      }
      MCE._editingAudio.text = text;
      if(MCE._editingAudio.satus) {
        MCE._replacePText(MCE._editingAudio.p, text);
      }
    }
  
    MCE._replacePText = function(p, text){
      while (p.children.length > 1) {
        p.lastChild.remove();
      }
      MCE._setCursor(p.lastChild);
      MCE.insertText(text);
      MCE._onInput.call(MCE._contentDom);
    }
  
    // 显隐录音对应的文本
    MCE.setAudioTextStatus = function(status) {
      MCE._editingAudio.satus = status;
      MCE._historyListener = true;
      if(!MCE._editingAudio.satus) {
        MCE._history_removeElement(MCE._editingAudio.p);
        MCE._onInput.call(MCE._contentDom);
        MCE._setCursor(MCE._editingAudio.canvas.parentElement.nextSibling.firstChild);
        MCE._updateLastHistoryStepCursor();
        MCE._setCursorHidden(true);
      } else {
        MCE._setCursorHidden(false);
        MCE._history_insertElement(MCE._editingAudio.p, MCE._editingAudio.canvas.parentElement, "after");
        MCE._onInput.call(MCE._contentDom);
        MCE.updateAudioText(MCE._editingAudio.text);
      }
      MCE._historyListener = false;
    }
  
    // 取消录音
    MCE.cancelAudio = function() {
      MCE.DEBUGER && console.log("cancelAudio");
      if (!MCE._editingAudio) {
        MCE.DEBUGER && console.log("No Editing Audio");
        return false;
      }
      MCE._setCursorHidden(false);
      MCE._historyListener = true;
  
      MCE._history_removeElement(MCE._editingAudio.p);
      MCE._history_removeElement(MCE._editingAudio.canvas.parentElement);
      MCE._editingAudio = null;
      // MCE.setEditing(true);
      MCE._onInput.call(MCE._contentDom);
      MCE.blur();
      return true;
    }
  
    // 结束录音
    MCE.endAudio = function (id, duration) {
      MCE.DEBUGER && console.log("endAudio", id, duration);
      var time = Date.now();
      if (!MCE._editingAudio) {
        MCE.DEBUGER && console.log("No Editing Audio");
        return false;
      }
  
      var p = MCE._editingAudio.p;
      var text = MCE._editingAudio.text;
      var canvas = MCE._editingAudio.canvas;
  
      MCE._editingAudio = null;
      MCE._setCursorHidden(false);
      MCE.setEditing(true);
      MCE._historyListener = true;
  
      MCE._replacePText(p, text);
      canvas.id = "audio_" + id;
      canvas.setAttribute("data-id", id);
      canvas.setAttribute("data-duration", duration);
      MCE.renderAudio(canvas);
      MCE.DEBUGER && console.log("endAudioTimer", Date.now() - time);
      MCE._onInput.call(MCE._contentDom);
      return true;
    }
  
    MCE.createAudio = function (id, duration) {
      var canvas = document.createElement("canvas");
      canvas.classList.add("resource");
      canvas.classList.add("audio");
      canvas.id = ("i" + (++MCE._autoUUID));
      canvas.setAttribute("data-id", id);
      canvas.setAttribute("data-duration", duration);
  
      MCE.renderAudio(canvas);
  
      return canvas;
    }
  
    MCE.renderAudio = function (canvas) {
      var ctx = canvas.getContext("2d");
      var aid = canvas.getAttribute("data-id");
      canvas.width = MCE._resourceWidth;
      canvas.height = MCE._config.trueAudioHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      if (MCE._editingAudio) {
        // 录音状态
        ctx.font = "30px PingFangSC-Regular";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "#666666";
        ctx.fillText("正在录音...", 20, MCE._config.audioHeight);
      } else {
        if (MCE._playingAudio == canvas.id && MCE._playAudioCache[MCE._playingAudio].status == 1 && MCE._playAudioCache[MCE._playingAudio].loopTime) {
          MCE._playAudioCache[MCE._playingAudio].time += (Date.now() - MCE._playAudioCache[MCE._playingAudio].loopTime) / 1000;
        }
        var duration = parseInt(canvas.getAttribute("data-duration"));
        var ds = MCE._playingAudio == canvas.id && MCE._playAudioCache[MCE._playingAudio] ? MCE._playAudioCache[MCE._playingAudio].time : 0;
        // 时长
        ctx.font = "24px PingFangSC-Regular";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillStyle = "#666666";
        // 当前播放时长
        ctx.fillText(MCE._formatDuration(ds), 104, MCE._config.audioHeight, 80);
        // 总时长
        ctx.fillText(MCE._formatDuration(duration), MCE._resourceWidth - MCE._config.audioHeight, MCE._config.audioHeight, MCE._config.trueAudioHeight);
  
        // 播放或暂停按钮
        ctx.drawImage(MCE._playingAudio == canvas.id && MCE._playAudioCache[MCE._playingAudio].status == 1 ? IMAGE_AUDIOPAUSE : IMAGE_AUDIOPLAY, 20, 22, MCE._config.audioHeight, MCE._config.audioHeight);
  
        // 播放进度条
        ctx.fillStyle = "#CCCCCC";
        ctx.fillRect(144, 43, MCE._resourceWidth - 232, 2);
        if (MCE._playingAudio == canvas.id && MCE._playAudioCache[MCE._playingAudio].status) {
          ctx.fillStyle = "#FF8000";
          var x = (MCE._resourceWidth - 232) * (MCE._playAudioCache[MCE._playingAudio].time / duration),
            y = MCE._config.audioHeight;
          ctx.fillRect(144, 43, x, 2);
  
          ctx.arc(x + 144, y, 10, 0, 2 * Math.PI);
          ctx.fill();
  
          if (MCE._playAudioCache[MCE._playingAudio].status == 1 && ds >= duration) {
            MCE.stopAudio();
          }
        }
      }
  
      // 渲染选中状态
      if(canvas.classList.contains("selected")) {
        ctx.fillStyle = MCE._config.selectedBackgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  
    MCE.playAudioLoop = function () {
      MCE.renderAudio(document.getElementById(MCE._playingAudio));
      if (MCE._playingAudio) {
        MCE._playingAudioRafid = window.requestAnimationFrame(MCE.playAudioLoop);
        MCE._playAudioCache[MCE._playingAudio].loopTime = Date.now();
      }
    }
  
    MCE.playAudio = function (domId, start) {
      if (!document.getElementById(domId)) {
        return;
      }
      MCE.DEBUGER && console.log("playAudio", domId, start);
      MCE._playingAudio = domId;
      if(!MCE._playAudioCache) {
        MCE._playAudioCache = {};
      }
      MCE._playAudioCache[domId] = {
        time: start || 0,
        status: 1,
        loopTime: 0
      };
      MCE._playingAudioRafid = window.requestAnimationFrame(MCE.playAudioLoop);
    }
  
    MCE.pauseAudio = function () {
      if (MCE._playingAudio) {
        var audio = document.getElementById(MCE._playingAudio);
        var aid = audio.getAttribute("data-id");
        MCE._sendClientMessage("stopAudio", {
          id: aid
        });
        MCE._playAudioCache[MCE._playingAudio].status = 2;
        MCE._playAudioCache[MCE._playingAudio].loopTime = 0;
        window.cancelAnimationFrame(MCE._playingAudioRafid);
        MCE.renderAudio(audio);
      }
    }
  
    MCE.stopAudio = function () {
      if (MCE._playingAudio) {
        var audio = document.getElementById(MCE._playingAudio);
        var aid = audio.getAttribute("data-id");
        MCE._playAudioCache[MCE._playingAudio].status = 0;
        MCE._playAudioCache[MCE._playingAudio].loopTime = 0;
        window.cancelAnimationFrame(MCE._playingAudioRafid);
        MCE._playingAudio = null;
        MCE.renderAudio(audio);
        MCE._sendClientMessage("stopAudio", {
          id: aid
        });
      }
    }
  
    MCE.getAllAudios = function () {
      var audios = document.getElementsByClassName("audio");
      var ids = [];
      for (var i = 0; i < audios.length; ++i) {
        ids.push(audios[i].getAttribute("data-id"));
      }
      return ids;
    }
  
    // 插入视频
    MCE.insertVideo = function (id, imageData, imageWidth, imageHeight, duration) {
      MCE.DEBUGER && console.log("insertVideo", id, imageData, imageWidth, imageHeight, duration);
      var video = document.createElement("canvas");
      video.classList.add("resource");
      video.classList.add("video");
      video.id = "i" + (++MCE._autoUUID);
      video.setAttribute("data-id", id);
      video.setAttribute("data-imageWidth", imageWidth);
      video.setAttribute("data-imageHeight", imageHeight);
      video.setAttribute("data-duration", duration);
  
      if(!MCE._insertResource(video)) {
        return false;
      }
  
      MCE.renderVideo(id, imageData);
  
  
      MCE._onInput.call(MCE._contentDom);
      return video;
    }
  
    // 绘制视频资源
    MCE.renderVideo = function (videoId, imageData) {
      MCE.DEBUGER && console.log("renderVideo", videoId, imageData);
      var videos = MCE._getResourceForId(videoId),
        imageWidth = videos[0].getAttribute("data-imageWidth"),
        imageHeight = videos[0].getAttribute("data-imageHeight"),
        canvasWidth = MCE._resourceWidth,
        canvasHeight = canvasWidth / imageWidth * imageHeight,
        imageCache = MCE._imageCache[videoId];
      for(var i = 0; i < videos.length; ++i) {
        videos[i].width = canvasWidth;
        videos[i].height = canvasHeight;
        videos[i].ctx = videos[i].getContext("2d");
      }
      if(!imageCache) {
        for(var i = 0; i < videos.length; ++i) {
          videos[i].ctx.fillStyle = "#EEEEEE";
          videos[i].ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
        if(!imageData) {
          MCE._sendClientMessage("getImage", {
            id: videoId,
            type: 'video'
          });
        } else {
          MCE._addImageCache(videoId, imageData, function() {
            MCE.renderVideo(videoId);
          });
        }
      } else {
        for(var i = 0; i < videos.length; ++i) {
          videos[i].ctx.drawImage(imageCache.obj, 0, 0, canvasWidth, canvasHeight);
        }
      }
  
      for(var i = 0; i < videos.length; ++i) {
        MCE.renderVideoController(videos[i], videos[i].ctx);
        // 渲染选中状态
        if(videos[i].classList.contains("selected")) {
          videos[i].ctx.fillStyle = MCE._config.selectedBackgroundColor;
          videos[i].ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
      }
    }
  
    MCE.renderVideoController = function (canvas, ctx) {
      // 播放按钮
      var btnSize = 80;
      ctx.drawImage(
        IMAGE_VIDEOPLAY,
        (MCE._resourceWidth - btnSize) / 2,
        (canvas.height - btnSize) / 2,
        btnSize, btnSize
      );
  
      // 时长背景
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = 0;
      var getRads = function (degrees) {
        return (Math.PI * degrees) / 180;
      }
      var arc = {
        x: 32,
        y: canvas.height - 32,
        r: 20
      };
      ctx.beginPath(); // 起始点设置在圆心处
      ctx.moveTo(arc.x, arc.y);
      ctx.arc(arc.x, arc.y, arc.r, getRads(90), getRads(270)); // 闭合路径
      ctx.closePath();
      // ctx.stroke();
      arc.x = MCE._config.audioProgressBar.left;
      // ctx.beginPath(); // 起始点设置在圆心处
      ctx.moveTo(arc.x, arc.y);
      ctx.arc(arc.x, arc.y, arc.r, getRads(90), getRads(-90), true); // 闭合路径
      ctx.closePath();
      ctx.fill();
  
      ctx.fillRect(32, canvas.height - 52, 40, 40);
  
      // 时长
      ctx.font = "24px PingFangSC-Regular";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(MCE._formatDuration(canvas.getAttribute("data-duration")), 52, canvas.height - 32, 80);
    }
  
    MCE.getAllVideos = function () {
      var videos = document.getElementsByClassName("video");
      var ids = [];
      for (var i = 0; i < videos.length; ++i) {
        ids.push(videos[i].getAttribute("data-id"));
      }
      return ids;
    }
  
    MCE.getIAV = function() {
      var allResource = MCE.getAllResource();
      var iav = [];
      for(var i = 0; i < allResource.length; ++i) {
        if(allResource[i].type == "image" || allResource[i].type == "video") {
          iav.push(allResource[i]);
        }
      }
      return iav;
    }
  
    MCE.getResourceIndexForIAV = function(domId) {
      var resources = document.getElementsByClassName("resource");
      var t = 0;
      var type;
      for(var i = 0; i < resources.length; ++i) {
        type = MCE._getResourceType(resources[i]);
        if(type == "image" || type == "video") {
          if(resources[i].id == domId) {
            return t;
          }
          t++;
        }
      }
    }
  
    MCE.getAllResource = function () {
      var resources = document.getElementsByClassName("resource");
      var rs = [];
      for (var i = 0; i < resources.length; ++i) {
        rs.push({
          id: resources[i].getAttribute("data-id"),
          type: MCE._getResourceType(resources[i])
        });
      }
      return rs;
    }
  
    MCE._getResourceType = function(canvas) {
      if(canvas.classList.contains("image")) {
        return "image";
      }
      if(canvas.classList.contains("audio")) {
        return "audio";
      }
      if(canvas.classList.contains("video")) {
        return "video";
      }
      return false;
    }
  
    // 重绘所有资源
    MCE._renderAllResource = function () {
      var resources = document.getElementsByClassName("resource");
      for(var i = 0; i < resources.length; ++i) {
        MCE._renderResource(resources[i]);
      }
    }
    
    // 重绘资源
    MCE._renderResource = function(canvas) {
      if(!canvas) {
        return false;
      }
      if(canvas.classList.contains("image")) {
        MCE.renderImage(canvas.getAttribute("data-id"));
      }
      if(canvas.classList.contains("audio")) {
        MCE.renderAudio(canvas);
      }
      if(canvas.classList.contains("video")) {
        MCE.renderVideo(canvas.getAttribute("data-id"));
      }
    }
  
    // 插入列表
    // 列表样式传参 参考 http://www.w3school.com.cn/cssref/pr_list-style-type.asp
    MCE.setList = function (style) {
  
      style = style || MCE._config.listStyle.CIRCLE;
      MCE.DEBUGER && console.log("setList", style);
  
      MCE._insertHistory();
  
      var pfc = MCE._cursorNode.parentElement;
      if(pfc.classList.contains("resourceBox")) {
        MCE.DEBUGER && console.log("resourceBox can not setList");
        return;
      }
  
      var ppfc = pfc.previousSibling || null;
      if (pfc.classList.contains("list") && pfc.getAttribute("data-list-style") == style) {
        MCE.removeListStyle(pfc);
      } else {
        if (!pfc.classList.contains("list")) {
          MCE._history_addClassName(pfc, "list");
          if(MCE.getContentHeight() > MCE._config.maxContentHeight) {
            pfc.classList.remove("list");
            MCE._sendClientMessage("showError", MCE._config.maxContentHeight_errorText);
            return false;
          }
        }
        if (pfc.classList.contains("task")) {
          MCE._history_removeClassName(pfc, "task");
        }
        MCE._history_setAttribute(pfc, "data-list-style", style);
        switch (parseInt(style)) {
          case MCE._config.listStyle.CIRCLE:
            MCE._history_setAttribute(pfc, "data-before", "●");
            break;
          case MCE._config.listStyle.TASK:
            MCE._history_removeAttribute(pfc, "data-before");
            MCE._history_addClassName(pfc, "task");
            break;
          case MCE._config.listStyle.NUMBER:
            if (ppfc && parseInt(ppfc.getAttribute("data-list-style")) == MCE._config.listStyle.NUMBER) {
              var i = parseInt(ppfc.getAttribute("data-before"));
              var t = pfc;
              while (t && t.classList.contains("list") && parseInt(t.getAttribute("data-list-style")) == MCE._config.listStyle.NUMBER) {
                i += 1;
                
                MCE._history_setAttribute(t, "data-before", i + ".");
                t = t.nextSibling;
              }
            } else {
              MCE._history_setAttribute(pfc, "data-before", '1.');
            }
            break;
          case MCE._config.listStyle.LETTER:
            if (ppfc && parseInt(ppfc.getAttribute("data-list-style")) == MCE._config.listStyle.LETTER) {
              var chars = ppfc.getAttribute("data-before").split("");
              var nums = [];
              for (var i = 0; i < chars.length - 1; i++) {
                nums.push(chars[i].charCodeAt());
              }
              var t = pfc;
              while (t && t.classList.contains("list") && parseInt(t.getAttribute("data-list-style")) == MCE._config.listStyle.LETTER) {
                var lb = "",
                  n1 = true;
                for (var i = nums.length - 1; i >= 0; i--) {
                  if (n1) {
                    nums[i]++;
                    if (nums[i] > 90) {
                      nums[i] = 65;
                      n1 = true;
                    } else {
                      n1 = false;
                    }
                  }
                  lb = String.fromCharCode(nums[i]) + lb;
                }
                if (n1) {
                  lb = "A" + lb;
                  nums.unshift(65);
                }
                MCE._history_setAttribute(t, "data-before", lb + '.');
                t = t.nextSibling;
              }
            } else {
              MCE._history_setAttribute(pfc, "data-before", "A.");
            }
            break;
        }
      }
      MCE._setCursor(MCE._cursorNode, MCE._cursorNodeLocation);
      MCE._updateLastHistoryStepCursor();
      MCE._onInput.call(MCE._contentDom);
    }
  
    // 加粗文本
    MCE.setBold = function () {
      MCE.DEBUGER && console.log("setBold", 0);
  
      MCE._setStyle("bold");
    }
  
    // 斜体文本
    MCE.setItalic = function () {
      MCE.DEBUGER && console.log("setItalic", 0);
  
      MCE._setStyle("italic");
    }
  
    // 下划线文本
    MCE.setUnderline = function () {
      MCE.DEBUGER && console.log("setUnderline", 0);
  
      MCE._setStyle("underline");
    }
  
    // 左对齐文本
    MCE.setLeftAlign = function () {
      MCE.DEBUGER && console.log("setLeftAlign", 0);
  
      MCE._insertHistory();
      MCE._setStyle("align", "left");
    }
  
    // 右对齐文本
    MCE.setRightAlign = function () {
      MCE.DEBUGER && console.log("setRightAlign", 0);
  
      MCE._insertHistory();
      MCE._setStyle("align", "right");
    }
  
    // 居中对齐文本
    MCE.setCenterAlign = function () {
      MCE.DEBUGER && console.log("setCenterAlign", 0);
  
      MCE._insertHistory();
      MCE._setStyle("align", "center");
    }
  
    MCE._textStyleNames = {
      bold: "fontWeight",
      italic: "fontStyle",
      underline: "textDecoration",
    };
    MCE._textStyleValues = {
      bold: ["normal", "bold"],
      italic: ["normal", "italic"],
      underline: ["none", "underline"]
    };
  
    // 设置样式或取消样式
    MCE._setStyle = function (styleName, styleValue) {
      var selecteds = document.getElementsByClassName("selected");
      if(selecteds.length > 0) {
        if(styleName == "align") {
          if(MCE._textStyle.align != styleValue) {
            var startp = selecteds[0].parentElement;
            var endp = selecteds[selecteds.length - 1].parentElement;
            var t = startp, d = true;
            while(d && t) {
              if(t == endp) d = false;
              MCE._setNodeStyle(t, "align", styleValue);
              t = t.nextSibling;
            }
            MCE._textStyle.align = styleValue;
          }
        } else {
          for(var i = 0; i < selecteds.length; ++i) {
            MCE._setNodeStyle(selecteds[i], styleName, !MCE._textStyle[styleName]);
          }
          MCE._textStyle[styleName] = !MCE._textStyle[styleName];
        }
      } else {
        if(styleName == "align") {
          if(MCE._setNodeStyle(MCE._cursorNode.parentElement, "align", styleValue)) {
            MCE._textStyle[styleName] = styleValue;
          }
        } else {
          MCE._textStyle[styleName] = !MCE._textStyle[styleName];
        }
      }
  
      MCE._setCursor(MCE._cursorNode);
  
      MCE._hideOperationMenu();
  
      MCE._sendClientMessage("textStyle", MCE._textStyle);
      MCE.DEBUGER && console.log(MCE._textStyle);
    }
  
    MCE._setNodeStyle = function(node, styleName, styleValue) {
      if(styleName == "align") {
        if(!node.classList.contains("resourceBox") && node.style.textAlign != styleValue) {
          MCE._history_setStyle(node, "textAlign", styleValue);
          return true;
        }
        return false;
      } else {
        if(!node.classList.contains("resource")) {
          MCE._history_setStyle(node, MCE._textStyleNames[styleName], MCE._textStyleValues[styleName][Number(styleValue)]);
          return true;
        }
        return false;
      }
    }
  
    // 设置光标位置为某元素
    // @node    光标定位的元素
    // @beforeAfter   光标在元素之前还是之后  true为元素之前 false或不填为元素之后
    MCE._setCursor = function (node, beforeAfter) {
      MCE.DEBUGER && console.log("_setCursor", node, beforeAfter);
      if (node) {
        if (node.nodeName.toLowerCase() == "p") {
          node = node.lastChild;
        }
        var p = node.parentElement;
        var left;
        if(p.innerText.length == 0 && !p.classList.contains("resourceBox")) {
          switch(p.style.textAlign) {
            case "center":
              left = window.innerWidth / 2;
            break;
            case "right":
              left = window.innerWidth - MCE._config.contentPadding;
            break;
            default:
              left = p.classList.contains("list") ? MCE._config.listContentPadding : MCE._config.contentPadding;
            break;
          }
        } else {
          var nodeOffset = node == p.firstChild ? MCE._getOffsetOfDocument(node.nextSibling) : MCE._getOffsetOfDocument(node);
          left = nodeOffset.x;
          if(!beforeAfter) {
            left += node.offsetWidth
          }
          if (!left && p.classList.contains("list")) {
            left += parseInt(window.getComputedStyle(p, null).paddingLeft);
          }
          left -= 1.5;
        }
        MCE._cursor.style.left = left + "px";
  
        // 记录文本样式
        if(!MCE._cpLock) { // 组合输入锁定时，不更新样式
          var nodeStyle = MCE._getNodeStyle(node);
          if(node != MCE._cursorNode) {
            MCE._textStyle = nodeStyle;
          }
          if(MCE._textStyle) {
            MCE._textStyle.align = nodeStyle.align;
          }
          MCE._sendClientMessage("textStyle", MCE._textStyle);
        }
        
        MCE._cursorNode = node;
        MCE._cursorNodeLocation = beforeAfter || false;
  
        // 马上更新一次光标
        MCE._cursorFlickerFlag = true;
        MCE._cursorFlicker();
  
        MCE._updateCursorTop();
        MCE._updateSelectController();
  
        // MCE.DEBUGER && console.log("_keyboardStatus _editingAudio", !MCE._keyboardStatus, !MCE._editingAudio);
        if(!MCE._keyboardStatus && !MCE._editingAudio) {
          // MCE.DEBUGER && console.log("_virtualInputFocus", MCE._virtualInput);
          document.activeElement = MCE._virtualInput;
          MCE._virtualInput.focus();
        }
  
        if(!MCE._cursorNode.classList.contains("resource")) {
          MCE._scrollToCursor();
        }
      }
      return node;
    }
  
    MCE._updateCursorTop = function() {
      if(MCE._cursorNode) {
        var top = MCE._cursorNode.offsetTop;
        top += MCE._cursorNode.parentElement.offsetTop + MCE._contentDom.y;
        MCE._cursor.style.top = top + "px";
      }
    }
  
    // 移除光标
    MCE._removeCursor = function () {
      MCE._virtualInput.blur();
      MCE._cursorFlickerTimer && clearTimeout(MCE._cursorFlickerTimer);
      MCE._cursorFlickerTimer = null;
      MCE._cursor.style.left = "-100px";
      MCE._cursor.style.top = "-100px";
      // MCE._cursorNode = null;
      document.activeElement.blur();
    }
  
    MCE._scrollToCursor = function () {
      MCE._scrollToCursorTimer && clearTimeout(MCE._scrollToCursorTimer);
      MCE._scrollToCursorTimer = setTimeout(function(){
        MCE.DEBUGER && console.log("_scrollToCursor", (MCE._virtualInputFocus || MCE._editingAudio), MCE.getContentHeight(true), window.innerHeight);
        if ((MCE._virtualInputFocus || MCE._editingAudio) && MCE.getContentHeight(true) > window.innerHeight) {
          MCE.dscroll.scrollStop = true;
          var nodeOffset = MCE._getOffsetOfDocument(MCE._cursorNode);
          var scrollY = MCE._contentDom.y ? -MCE._contentDom.y : 0;
          MCE.DEBUGER && console.log("nodeOffset.y scrollY windowHeight contentY", nodeOffset.y, scrollY, window.innerHeight, MCE._contentDom.y);
          if (nodeOffset.y < scrollY) {
            MCE.DEBUGER && console.log("scroll up", -(nodeOffset.y - 15));
            MCE.dscroll.setPageY(-(nodeOffset.y - 15));
          } else if (nodeOffset.y + MCE._cursorNode.offsetHeight - scrollY - window.innerHeight >= -MCE._config.lineHeight) {
            MCE.DEBUGER && console.log("scroll down", -(nodeOffset.y + MCE._cursorNode.offsetHeight - window.innerHeight + MCE._config.lineHeight));
            MCE.dscroll.setPageY(-(nodeOffset.y + MCE._cursorNode.offsetHeight - window.innerHeight + MCE._config.lineHeight));
          }
        }
      }, 50);
    }
  
    MCE._getNodeStyle = function(node) {
      return {
        bold: node.style.fontWeight == "bold",
        italic: node.style.fontStyle == "italic",
        underline: node.style.textDecoration == "underline",
        align: node.parentElement.style.textAlign || "left"
      };
    }
  
    MCE._insertBefore = function(newElement, targentElement){
      targentElement.parentElement.insertBefore(newElement, targentElement);
    }
  
    MCE._insertAfter = function (newElement, targentElement) {
      var parent = targentElement.parentElement;
      if (parent.lastChild == targentElement) {
        parent.appendChild(newElement);
      } else {
        parent.insertBefore(newElement, targentElement.nextSibling)
      }
    }
  
    MCE._p = function (text) {
      var p = document.createElement("p");
      p.id = "i" + (++MCE._autoUUID);
      p.appendChild(MCE._ss());
      if (text) {
        var tarr = text.split("");
        for (var i = 0; i < tarr.length; ++i) {
          p.appendChild(MCE._ss(tarr[i]));
        }
      }
      return p;
    }
  
    MCE._ss = function (str, id) {
      var s = document.createElement("ss");
      s.id = id || ("i" + (++MCE._autoUUID));
      if (str) {
        switch (str) {
          case "'":
            str = '&apos;';
          break;
          case '"':
            str = '&quot;';
            break;
          case '&':
            str = '&amp;';
            break;
          case '<':
            str = '&lt;';
            break;
          case '>':
            str = '&gt;';
            break;
          case ' ':
            str = '&nbsp;';
            break;
        }
        s.innerHTML = str;
        if (MCE._textStyle) {
          if (MCE._textStyle.bold) s.style.fontWeight = "bold";
          if (MCE._textStyle.italic) s.style.fontStyle = "italic";
          if (MCE._textStyle.underline) s.style.textDecoration = "underline";
        }
      }
      return s;
    }
  
    MCE._getOffsetOfDocument = function(node){
      var offset = {
        x: 0,
        y: 0
      }, t = node;
      while(t && t != MCE._contentDom) {
        offset.x += t.offsetLeft;
        offset.y += t.offsetTop;
        t = t.parentElement;
      }
      return offset;
    }
  
    MCE._insertHistory = function(){
      if(!MCE._historyListener) {
        return;
      }
      if(!MCE._history) {
        MCE._history = [];
        MCE._historyIndex = -1;
      }
      if(MCE._history[MCE._historyIndex + 1]) {
        var t = MCE._history.length - 1;
        while(t > MCE._historyIndex) {
          MCE._history.pop();
          t--;
        }
      }
  
      MCE._history.push([]);
      MCE._historyIndex++;
    }
  
    // 插入一个历史步骤
    // @type 步骤类型
    // @nodeId 被操作元素的ID
    // @data 步骤数据
    MCE._insertHistoryStep = function(type, nodeId, data) {
      if(!MCE._historyListener) {
        return false;
      }
      if(!MCE._history) {
        MCE._insertHistory();
      }
      var historyStep = {
        type: type, // 步骤类型
        cursorNodeId: MCE._cursorNode.id, // 步骤发生时的光标元素ID
        cursorNodeLocation: MCE._cursorNodeLocation, // 步骤发生时的光标定位
        nodeId: nodeId, // 步骤的作用元素ID
        data: data // 步骤数据
      };
      MCE._history[MCE._historyIndex].push(historyStep);
      MCE._lastHistoryStep = historyStep;
  
      MCE._sendClientMessage_historyStatus();
      MCE._hideOperationMenu();
      return true;
    }
  
    // 更新最后一个历史步骤后的光标信息
    MCE._updateLastHistoryStepCursor = function(){
      if(!MCE._historyListener) {
        return false;
      }
      if(MCE._lastHistoryStep) {
        MCE._lastHistoryStep.newCursor = {
          nodeId: MCE._cursorNode.id,
          nodeLocation: MCE._cursorNodeLocation
        };
      }
    }
  
    // 历史记录 插入元素
    // @element 插入的元素
    // @pElement 插入元素时用做定位的元素
    // @bai 插入到定位元素的哪个位置 before 之前 after 之后 in 之内
    MCE._history_insertElement = function(element, pElement, bai){
      MCE._insertHistoryStep("insertElement", null, {
        element: element.cloneNode(true),
        pElementId: pElement.id,
        bai: bai || "after"
      });
      if(bai == "after") {
        MCE._insertAfter(element, pElement);
      } else if(bai == "before") {
        MCE._insertBefore(element, pElement);
      } else {
        pElement.appendChild(element);
      }
    }
    // 历史记录 转移元素
    MCE._history_transferElement = function(element, before, after){
      MCE._insertHistoryStep("transferElement", null, {
        element: element.cloneNode(true),
        before: before.id,
        after: after.id
      });
      MCE._insertAfter(element, after);
    }
    // 历史记录 设置属性
    MCE._history_setAttribute = function(element, attrName, attrValue){
      MCE._insertHistoryStep("setAttr", element.id, {
        attrName: attrName,
        attrValue: attrValue,
        oldAttrValue: element.getAttribute(attrName)
      });
      element.setAttribute(attrName, attrValue);
    }
    // 历史记录 添加类名
    MCE._history_addClassName = function(element, className){
      MCE._insertHistoryStep("addClass", element.id, {
        className: className
      });
      element.classList.add(className);
    }
    // 历史记录 设置样式
    MCE._history_setStyle = function(element, styleName, styleValue){
      MCE._insertHistoryStep("setStyle", element.id, {
        styleName: styleName,
        styleValue: styleValue,
        oldStyleValue: element.style[styleName]
      });
      element.style[styleName] = styleValue;
    }
    // 历史记录 移除元素
    MCE._history_removeElement = function(element){
      MCE._insertHistoryStep("removeElement", null, {
        element: element.cloneNode(true)
      });
      element.remove();
    }
    // 历史记录 移除属性
    MCE._history_removeAttribute = function(element, attrName){
      var attrValue = element.getAttribute(attrName);
      if(attrValue == null) {
        return false;
      }
      MCE._insertHistoryStep("removeAttr", element.id, {
        attrName: attrName,
        attrValue: attrValue,
      });
      element.removeAttribute(attrName);
    }
    // 历史记录 移除类名
    MCE._history_removeClassName = function(element, className){
      MCE._insertHistoryStep("removeClass", element.id, {
        className: className
      });
      element.classList.remove(className);
    }
  
    // 撤销
    MCE.undo = function() {
      if(!MCE._history || MCE._history.length == 0 || MCE._historyIndex < 0) {
        return;
      }
      MCE._historyListener = false;
  
      var h = MCE._history[MCE._historyIndex];
      if(h.length > 0) {
        var i = h.length - 1, step;
        while(i >= 0) {
          step = h[i];
          switch(step.type) {
            case "insertElement":
              document.getElementById(step.data.element.id).remove();
            break;
            case "insertText":
              if(step.data.firstCharId) {
                if(step.data.firstCharId == step.data.lastCharId) {
                  document.getElementById(step.data.firstCharId).remove();
                } else {
                  var firstChar = document.getElementById(step.data.firstCharId);
                  var lastChar = document.getElementById(step.data.lastCharId);
                  var t = firstChar, k;
                  while(t) {
                    k = t.nextSibling;
                    t.remove();
                    if(t == lastChar) {
                      break;
                    }
                    t = k;
                  }
                }
              }
            break;
            case "removeElement":
              var element = step.data.element;
              if(element.nodeName.toLocaleLowerCase() == "ss") {
                MCE._insertAfter(element, MCE._cursorNode);
              } else if(element.nodeName.toLocaleLowerCase() == "p") {
                MCE._insertAfter(element, MCE._cursorNode.parentElement);
                if(element.classList.contains("resourceBox")) {
                  MCE._renderResource(element.getElementsByClassName("resource")[0]);
                }
              }
            break;
            case "transferElement":
              MCE._insertAfter(document.getElementById(step.data.element.id), document.getElementById(step.data.before));
            break;
            case "removeContent":
              var sp = document.getElementById(step.data.vbody.firstChild.id);
              var fs = 0, fe = step.data.vbody.children.length;
              if(!sp) {
                sp = step.data.vbody.firstChild.cloneNode(true);
                if(step.data.spp) {
                  MCE._insertAfter(sp, document.getElementById(step.data.spp.id));
                } else if(step.data.epn) {
                  MCE._insertBefore(sp, document.getElementById(step.data.epn.id));
                } else {
                  MCE._contentDom.appendChild(sp);
                }
                if(sp.classList.contains("resourceBox")) {
                  MCE._renderResource(sp.getElementsByClassName("resource")[0]);
                }
                fs++;
              }
              var ep = document.getElementById(step.data.vbody.lastChild.id);
              if(!ep) {
                ep = step.data.vbody.lastChild.cloneNode(true);
                if(step.data.epn) {
                  MCE._insertBefore(ep, document.getElementById(step.data.epn.id));
                } else if(step.data.spp) {
                  MCE._insertAfter(ep, document.getElementById(step.data.spp.id));
                } else {
                  MCE._contentDom.appendChild(ep);
                }
                if(ep.classList.contains("resourceBox")) {
                  MCE._renderResource(ep.getElementsByClassName("resource")[0]);
                }
                fe--;
              }
              if(sp == ep) {
                sp.innerHTML = step.data.vhead.innerHTML + step.data.vbody.firstChild.innerHTML + step.data.vfoot.innerHTML;
              } else {
                for(fs; fs < fe; ++fs) {
                  if(fs == 0) {
                    sp.innerHTML += step.data.vbody.firstChild.innerHTML;
                  } else if(fs == step.data.vbody.children.length - 1) {
                    ep.innerHTML = step.data.vbody.lastChild.innerHTML + ep.innerHTML;
                  } else {
                    var np = step.data.vbody.children[fs].cloneNode(true);
                    MCE._insertAfter(np, sp);
                    if(np.classList.contains("resourceBox")) {
                      MCE._renderResource(np.getElementsByClassName("resource")[0]);
                    }
                    sp = sp.nextSibling;
                  }
                }
              }
            break;
            case "removeAttr":
              document.getElementById(step.nodeId).setAttribute(step.data.attrName, step.data.attrValue);
            break;
            case "setAttr":
              if(step.data.oldAttrValue) {
                document.getElementById(step.nodeId).setAttribute(step.data.attrName, step.data.oldAttrValue);
              } else {
                document.getElementById(step.nodeId).removeAttribute(step.data.attrName);
              }
            break;
            case "removeClass":
              document.getElementById(step.nodeId).classList.add(step.data.className);
            break;
            case "addClass":
              document.getElementById(step.nodeId).classList.remove(step.data.className);
            break;
            case "setStyle":
              document.getElementById(step.nodeId).style[step.data.styleName] = step.data.oldStyleValue;
            break;
          }
          i--;
          MCE._setCursor(document.getElementById(step.cursorNodeId), step.cursorNodeLocation);
        }
        MCE._sendClientMessage_textLength();
      }
      
      MCE._historyIndex--;
  
      MCE._historyListener = true;
  
      MCE._sendClientMessage_historyStatus();
      MCE._cancelSelectedContent();
    }
  
    // 恢复
    MCE.redo = function() {
      if(!MCE._history || MCE._history.length == 0 || MCE._historyIndex >= MCE._history.length - 1) {
        return;
      }
      MCE._historyListener = false;
  
      MCE._historyIndex++;
  
      var h = MCE._history[MCE._historyIndex];
      var i = 0, step;
      while(i < h.length) {
        step = h[i];
        if(step.cursorNodeId) {
          MCE._setCursor(document.getElementById(step.cursorNodeId), step.cursorNodeLocation);
        }
        switch(step.type) {
          case "insertElement":
            var element = step.data.element.cloneNode("true");
            var pElement = document.getElementById(step.data.pElementId);
            if(step.data.bai == "before") {
              MCE._insertBefore(element, pElement);
            } else if(step.data.bai == "after") {
              MCE._insertAfter(element, pElement)
            } else if(step.data.bai == "in") {
              pElement.appendChild(element);
            }
            if(element.classList.contains("resourceBox")) {
              MCE._renderResource(element.getElementsByClassName("resource")[0]);
            }
            MCE._sendClientMessage_textLength();
          break;
          case "insertText":
            MCE._textStyle = step.data.textStyle;
            MCE.insertText(step.data.text, 0, step.data.firstCharId, step.data.lastCharId);
            MCE._sendClientMessage_textLength();
          break;
          case "removeElement":
            document.getElementById(step.data.element.id).remove();
            MCE._sendClientMessage_textLength();
          break;
          case "transferElement":
            MCE._insertAfter(document.getElementById(step.data.element.id), document.getElementById(step.data.after));
          break;
          case "removeContent":
            MCE._selectContent(document.getElementById(step.data.startElement.id), document.getElementById(step.data.endElement.id));
            MCE._deleteSelectedContent();
          break;
          case "removeAttr":
            document.getElementById(step.nodeId).removeAttribute(step.data.attrName);
          break;
          case "setAttr":
            document.getElementById(step.nodeId).setAttribute(step.data.attrName, step.data.attrValue);
          break;
          case "removeClass":
            document.getElementById(step.nodeId).classList.remove(step.data.className);
          break;
          case "addClass":
            document.getElementById(step.nodeId).classList.add(step.data.className);
          break;
          case "setStyle":
            document.getElementById(step.nodeId).style[step.data.styleName] = step.data.styleValue;
          break;
        }
        if(step.newCursor) {
          MCE._setCursor(document.getElementById(step.newCursor.nodeId), step.newCursor.nodeLocation);
        }
        i++;
      }
  
      MCE._historyListener = true;
  
      MCE._sendClientMessage_historyStatus();
      MCE._cancelSelectedContent();
    }
  
    MCE.setViewAreaHeight = function (height) {
      // MCE.DEBUGER && console.log("setViewAreaHeight", height);
      if (height != MCE.viewAreaHeight) {
        MCE.viewAreaHeight = height;
        MCE._scrollToCursor();
      }
    }
  
    MCE.getContentHeight = function (ai) {
      var height = MCE._contentDom.offsetHeight;
      if (!ai) {
        height -= parseInt(window.getComputedStyle(MCE._contentDom, null).paddingTop);
        height -= parseInt(window.getComputedStyle(MCE._contentDom, null).paddingBottom);
      }
      return height;
    }
  
    MCE._formatDuration = function (duration) {
      duration = parseInt(duration);
      var s = (duration % 60);
      if (s < 10) s = "0" + s;
      var i = Math.floor(duration / 60);
      if(i < 10) i = "0" + i;
      return i + ":" + s;
    }
  
    MCE.printScreen = function() {
      MCE._printScreenCacheData = MCE._contentDom.y;
      MCE.dscroll.scrollStop = true;
      MCE.dscroll.setPageY(0);
      document.body.classList.add("printScreen");
      MCE.dscroll.release();
      window.scrollTo(0, -MCE._printScreenCacheData);
      setTimeout(function(){
        MCE._sendClientMessage("canPrintScreen", {})
      }, MCE.getContentHeight() / 10);
      // html2canvas(MCE._contentDom).then(canvas => {
      //   document.body.appendChild(canvas)
      // });
    }
  
    MCE.printScreenEnd = function() {
      document.body.classList.remove("printScreen");
      window.scrollTo(0, 0);
      MCE.dscroll.init();
      MCE.dscroll.setPageY(MCE._printScreenCacheData);
    }
  
    MCE.setKeyboardStatus = function(status) {
      MCE._keyboardStatus = status;
      if(status) {
        MCE._virtualInput.blur();
      } else {
        MCE._setCursor(MCE._cursorNode);
      }
    }
  
    window.MCE = MCE;
    // MCE.init();
  })();