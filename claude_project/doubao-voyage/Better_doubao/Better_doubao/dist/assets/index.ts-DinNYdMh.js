(function(){var J=Object.defineProperty;var K=(l,e,t)=>e in l?J(l,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[e]=t;var x=(l,e,t)=>K(l,typeof e!="symbol"?e+"":e,t);const N=[{id:"red",name:"红色",value:"#ef4444"},{id:"orange",name:"橙色",value:"#f97316"},{id:"yellow",name:"黄色",value:"#eab308"},{id:"green",name:"绿色",value:"#22c55e"},{id:"blue",name:"蓝色",value:"#3b82f6"},{id:"purple",name:"紫色",value:"#a855f7"},{id:"pink",name:"粉色",value:"#ec4899"},{id:"gray",name:"灰色",value:"#6b7280"}];function Y(l){const e=N.find(t=>t.id===l);return(e==null?void 0:e.value)??N[7].value}var ee=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};function te(l){return l&&l.__esModule&&Object.prototype.hasOwnProperty.call(l,"default")?l.default:l}var Q={exports:{}};(function(l,e){(function(t,s){s(l)})(typeof globalThis<"u"?globalThis:typeof self<"u"?self:ee,function(t){if(!(globalThis.chrome&&globalThis.chrome.runtime&&globalThis.chrome.runtime.id))throw new Error("This script should only be loaded in a browser extension.");if(globalThis.browser&&globalThis.browser.runtime&&globalThis.browser.runtime.id)t.exports=globalThis.browser;else{const s="The message port closed before a response was received.",o=r=>{const n={alarms:{clear:{minArgs:0,maxArgs:1},clearAll:{minArgs:0,maxArgs:0},get:{minArgs:0,maxArgs:1},getAll:{minArgs:0,maxArgs:0}},bookmarks:{create:{minArgs:1,maxArgs:1},get:{minArgs:1,maxArgs:1},getChildren:{minArgs:1,maxArgs:1},getRecent:{minArgs:1,maxArgs:1},getSubTree:{minArgs:1,maxArgs:1},getTree:{minArgs:0,maxArgs:0},move:{minArgs:2,maxArgs:2},remove:{minArgs:1,maxArgs:1},removeTree:{minArgs:1,maxArgs:1},search:{minArgs:1,maxArgs:1},update:{minArgs:2,maxArgs:2}},browserAction:{disable:{minArgs:0,maxArgs:1,fallbackToNoCallback:!0},enable:{minArgs:0,maxArgs:1,fallbackToNoCallback:!0},getBadgeBackgroundColor:{minArgs:1,maxArgs:1},getBadgeText:{minArgs:1,maxArgs:1},getPopup:{minArgs:1,maxArgs:1},getTitle:{minArgs:1,maxArgs:1},openPopup:{minArgs:0,maxArgs:0},setBadgeBackgroundColor:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},setBadgeText:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},setIcon:{minArgs:1,maxArgs:1},setPopup:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},setTitle:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0}},browsingData:{remove:{minArgs:2,maxArgs:2},removeCache:{minArgs:1,maxArgs:1},removeCookies:{minArgs:1,maxArgs:1},removeDownloads:{minArgs:1,maxArgs:1},removeFormData:{minArgs:1,maxArgs:1},removeHistory:{minArgs:1,maxArgs:1},removeLocalStorage:{minArgs:1,maxArgs:1},removePasswords:{minArgs:1,maxArgs:1},removePluginData:{minArgs:1,maxArgs:1},settings:{minArgs:0,maxArgs:0}},commands:{getAll:{minArgs:0,maxArgs:0}},contextMenus:{remove:{minArgs:1,maxArgs:1},removeAll:{minArgs:0,maxArgs:0},update:{minArgs:2,maxArgs:2}},cookies:{get:{minArgs:1,maxArgs:1},getAll:{minArgs:1,maxArgs:1},getAllCookieStores:{minArgs:0,maxArgs:0},remove:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}},devtools:{inspectedWindow:{eval:{minArgs:1,maxArgs:2,singleCallbackArg:!1}},panels:{create:{minArgs:3,maxArgs:3,singleCallbackArg:!0},elements:{createSidebarPane:{minArgs:1,maxArgs:1}}}},downloads:{cancel:{minArgs:1,maxArgs:1},download:{minArgs:1,maxArgs:1},erase:{minArgs:1,maxArgs:1},getFileIcon:{minArgs:1,maxArgs:2},open:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},pause:{minArgs:1,maxArgs:1},removeFile:{minArgs:1,maxArgs:1},resume:{minArgs:1,maxArgs:1},search:{minArgs:1,maxArgs:1},show:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0}},extension:{isAllowedFileSchemeAccess:{minArgs:0,maxArgs:0},isAllowedIncognitoAccess:{minArgs:0,maxArgs:0}},history:{addUrl:{minArgs:1,maxArgs:1},deleteAll:{minArgs:0,maxArgs:0},deleteRange:{minArgs:1,maxArgs:1},deleteUrl:{minArgs:1,maxArgs:1},getVisits:{minArgs:1,maxArgs:1},search:{minArgs:1,maxArgs:1}},i18n:{detectLanguage:{minArgs:1,maxArgs:1},getAcceptLanguages:{minArgs:0,maxArgs:0}},identity:{launchWebAuthFlow:{minArgs:1,maxArgs:1}},idle:{queryState:{minArgs:1,maxArgs:1}},management:{get:{minArgs:1,maxArgs:1},getAll:{minArgs:0,maxArgs:0},getSelf:{minArgs:0,maxArgs:0},setEnabled:{minArgs:2,maxArgs:2},uninstallSelf:{minArgs:0,maxArgs:1}},notifications:{clear:{minArgs:1,maxArgs:1},create:{minArgs:1,maxArgs:2},getAll:{minArgs:0,maxArgs:0},getPermissionLevel:{minArgs:0,maxArgs:0},update:{minArgs:2,maxArgs:2}},pageAction:{getPopup:{minArgs:1,maxArgs:1},getTitle:{minArgs:1,maxArgs:1},hide:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},setIcon:{minArgs:1,maxArgs:1},setPopup:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},setTitle:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},show:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0}},permissions:{contains:{minArgs:1,maxArgs:1},getAll:{minArgs:0,maxArgs:0},remove:{minArgs:1,maxArgs:1},request:{minArgs:1,maxArgs:1}},runtime:{getBackgroundPage:{minArgs:0,maxArgs:0},getPlatformInfo:{minArgs:0,maxArgs:0},openOptionsPage:{minArgs:0,maxArgs:0},requestUpdateCheck:{minArgs:0,maxArgs:0},sendMessage:{minArgs:1,maxArgs:3},sendNativeMessage:{minArgs:2,maxArgs:2},setUninstallURL:{minArgs:1,maxArgs:1}},sessions:{getDevices:{minArgs:0,maxArgs:1},getRecentlyClosed:{minArgs:0,maxArgs:1},restore:{minArgs:0,maxArgs:1}},storage:{local:{clear:{minArgs:0,maxArgs:0},get:{minArgs:0,maxArgs:1},getBytesInUse:{minArgs:0,maxArgs:1},remove:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}},managed:{get:{minArgs:0,maxArgs:1},getBytesInUse:{minArgs:0,maxArgs:1}},sync:{clear:{minArgs:0,maxArgs:0},get:{minArgs:0,maxArgs:1},getBytesInUse:{minArgs:0,maxArgs:1},remove:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}}},tabs:{captureVisibleTab:{minArgs:0,maxArgs:2},create:{minArgs:1,maxArgs:1},detectLanguage:{minArgs:0,maxArgs:1},discard:{minArgs:0,maxArgs:1},duplicate:{minArgs:1,maxArgs:1},executeScript:{minArgs:1,maxArgs:2},get:{minArgs:1,maxArgs:1},getCurrent:{minArgs:0,maxArgs:0},getZoom:{minArgs:0,maxArgs:1},getZoomSettings:{minArgs:0,maxArgs:1},goBack:{minArgs:0,maxArgs:1},goForward:{minArgs:0,maxArgs:1},highlight:{minArgs:1,maxArgs:1},insertCSS:{minArgs:1,maxArgs:2},move:{minArgs:2,maxArgs:2},query:{minArgs:1,maxArgs:1},reload:{minArgs:0,maxArgs:2},remove:{minArgs:1,maxArgs:1},removeCSS:{minArgs:1,maxArgs:2},sendMessage:{minArgs:2,maxArgs:3},setZoom:{minArgs:1,maxArgs:2},setZoomSettings:{minArgs:1,maxArgs:2},update:{minArgs:1,maxArgs:2}},topSites:{get:{minArgs:0,maxArgs:0}},webNavigation:{getAllFrames:{minArgs:1,maxArgs:1},getFrame:{minArgs:1,maxArgs:1}},webRequest:{handlerBehaviorChanged:{minArgs:0,maxArgs:0}},windows:{create:{minArgs:0,maxArgs:1},get:{minArgs:1,maxArgs:2},getAll:{minArgs:0,maxArgs:1},getCurrent:{minArgs:0,maxArgs:1},getLastFocused:{minArgs:0,maxArgs:1},remove:{minArgs:1,maxArgs:1},update:{minArgs:2,maxArgs:2}}};if(Object.keys(n).length===0)throw new Error("api-metadata.json has not been included in browser-polyfill");class a extends WeakMap{constructor(u,f=void 0){super(f),this.createItem=u}get(u){return this.has(u)||this.set(u,this.createItem(u)),super.get(u)}}const i=d=>d&&typeof d=="object"&&typeof d.then=="function",c=(d,u)=>(...f)=>{r.runtime.lastError?d.reject(new Error(r.runtime.lastError.message)):u.singleCallbackArg||f.length<=1&&u.singleCallbackArg!==!1?d.resolve(f[0]):d.resolve(f)},g=d=>d==1?"argument":"arguments",p=(d,u)=>function(b,...E){if(E.length<u.minArgs)throw new Error(`Expected at least ${u.minArgs} ${g(u.minArgs)} for ${d}(), got ${E.length}`);if(E.length>u.maxArgs)throw new Error(`Expected at most ${u.maxArgs} ${g(u.maxArgs)} for ${d}(), got ${E.length}`);return new Promise((S,k)=>{if(u.fallbackToNoCallback)try{b[d](...E,c({resolve:S,reject:k},u))}catch(h){console.warn(`${d} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `,h),b[d](...E),u.fallbackToNoCallback=!1,u.noCallback=!0,S()}else u.noCallback?(b[d](...E),S()):b[d](...E,c({resolve:S,reject:k},u))})},T=(d,u,f)=>new Proxy(u,{apply(b,E,S){return f.call(E,d,...S)}});let v=Function.call.bind(Object.prototype.hasOwnProperty);const y=(d,u={},f={})=>{let b=Object.create(null),E={has(k,h){return h in d||h in b},get(k,h,B){if(h in b)return b[h];if(!(h in d))return;let w=d[h];if(typeof w=="function")if(typeof u[h]=="function")w=T(d,d[h],u[h]);else if(v(f,h)){let P=p(h,f[h]);w=T(d,d[h],P)}else w=w.bind(d);else if(typeof w=="object"&&w!==null&&(v(u,h)||v(f,h)))w=y(w,u[h],f[h]);else if(v(f,"*"))w=y(w,u[h],f["*"]);else return Object.defineProperty(b,h,{configurable:!0,enumerable:!0,get(){return d[h]},set(P){d[h]=P}}),w;return b[h]=w,w},set(k,h,B,w){return h in b?b[h]=B:d[h]=B,!0},defineProperty(k,h,B){return Reflect.defineProperty(b,h,B)},deleteProperty(k,h){return Reflect.deleteProperty(b,h)}},S=Object.create(d);return new Proxy(S,E)},m=d=>({addListener(u,f,...b){u.addListener(d.get(f),...b)},hasListener(u,f){return u.hasListener(d.get(f))},removeListener(u,f){u.removeListener(d.get(f))}}),C=new a(d=>typeof d!="function"?d:function(f){const b=y(f,{},{getContent:{minArgs:0,maxArgs:0}});d(b)}),L=new a(d=>typeof d!="function"?d:function(f,b,E){let S=!1,k,h=new Promise(I=>{k=function(M){S=!0,I(M)}}),B;try{B=d(f,b,k)}catch(I){B=Promise.reject(I)}const w=B!==!0&&i(B);if(B!==!0&&!w&&!S)return!1;const P=I=>{I.then(M=>{E(M)},M=>{let q;M&&(M instanceof Error||typeof M.message=="string")?q=M.message:q="An unexpected error occurred",E({__mozWebExtensionPolyfillReject__:!0,message:q})}).catch(M=>{console.error("Failed to send onMessage rejected reply",M)})};return P(w?B:h),!0}),D=({reject:d,resolve:u},f)=>{r.runtime.lastError?r.runtime.lastError.message===s?u():d(new Error(r.runtime.lastError.message)):f&&f.__mozWebExtensionPolyfillReject__?d(new Error(f.message)):u(f)},R=(d,u,f,...b)=>{if(b.length<u.minArgs)throw new Error(`Expected at least ${u.minArgs} ${g(u.minArgs)} for ${d}(), got ${b.length}`);if(b.length>u.maxArgs)throw new Error(`Expected at most ${u.maxArgs} ${g(u.maxArgs)} for ${d}(), got ${b.length}`);return new Promise((E,S)=>{const k=D.bind(null,{resolve:E,reject:S});b.push(k),f.sendMessage(...b)})},G={devtools:{network:{onRequestFinished:m(C)}},runtime:{onMessage:m(L),onMessageExternal:m(L),sendMessage:R.bind(null,"sendMessage",{minArgs:1,maxArgs:3})},tabs:{sendMessage:R.bind(null,"sendMessage",{minArgs:2,maxArgs:3})}},$={clear:{minArgs:1,maxArgs:1},get:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}};return n.privacy={network:{"*":$},services:{"*":$},websites:{"*":$}},y(r,G,n)};t.exports=o(chrome)}})})(Q);var se=Q.exports;const O=te(se),F="dvFolderData",Z="dvFolderBackup";function V(l){if(typeof l!="object"||l===null)return!1;const e=l;return Array.isArray(e.folders)&&typeof e.folderContents=="object"&&typeof e.starredMessages=="object"&&Array.isArray(e.corpusBoard)}function oe(l){try{localStorage.setItem(Z,JSON.stringify({data:l,timestamp:Date.now()}))}catch(e){console.warn("[Storage] Backup failed:",e)}}function H(){try{const l=localStorage.getItem(Z);if(l){const e=JSON.parse(l);if(e.data&&V(e.data))return e.data}}catch(l){console.warn("[Storage] Restore from backup failed:",l)}return null}class re{constructor(){x(this,"data",{folders:[],folderContents:{},starredMessages:{},corpusBoard:[]});x(this,"saveTimer",null)}async init(){try{const e=await O.storage.local.get(F);if(e[F]&&V(e[F]))this.data=e[F],console.log("[Storage] Loaded from chrome.storage");else{const t=H();t&&(this.data=t,await this.persist(),console.log("[Storage] Restored from localStorage backup"))}}catch(e){console.error("[Storage] Init error:",e);const t=H();t&&(this.data=t)}}async persist(){oe(this.data);try{await O.storage.local.set({[F]:this.data})}catch(e){console.error("[Storage] Save failed:",e)}}debouncedSave(){this.saveTimer&&clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>{this.persist(),this.saveTimer=null},300)}async getData(){return this.data}async saveFolders(e){this.data.folders=e,this.debouncedSave()}async getFolders(){return this.data.folders}async addFolder(e){this.data.folders.push(e),this.data.folderContents[e.id]=[],this.debouncedSave()}async updateFolder(e,t){const s=this.data.folders.findIndex(o=>o.id===e);s!==-1&&(this.data.folders[s]={...this.data.folders[s],...t,updatedAt:Date.now()},this.debouncedSave())}async deleteFolder(e){this.data.folders=this.data.folders.filter(t=>t.id!==e),delete this.data.folderContents[e],this.debouncedSave()}async addConversationToFolder(e,t){this.data.folderContents[e]||(this.data.folderContents[e]=[]),this.data.folderContents[e].some(o=>o.conversationId===t.conversationId)||(this.data.folderContents[e].push(t),this.debouncedSave())}async removeConversationFromFolder(e,t){this.data.folderContents[e]&&(this.data.folderContents[e]=this.data.folderContents[e].filter(s=>s.conversationId!==t),this.debouncedSave())}async getConversationFolders(e){const t=[];for(const[s,o]of Object.entries(this.data.folderContents))o.some(r=>r.conversationId===e)&&t.push(s);return t}async getFolderContents(e){return this.data.folderContents[e]??[]}async getStarredMessages(e){return this.data.starredMessages[e]??[]}async addStarredMessage(e,t){this.data.starredMessages[e]||(this.data.starredMessages[e]=[]),this.data.starredMessages[e].includes(t)||(this.data.starredMessages[e].push(t),this.debouncedSave())}async removeStarredMessage(e,t){if(this.data.starredMessages[e]){const s=this.data.starredMessages[e].indexOf(t);s>-1&&(this.data.starredMessages[e].splice(s,1),this.debouncedSave())}}async toggleStarredMessage(e,t){return await this.isMessageStarred(e,t)?(await this.removeStarredMessage(e,t),!1):(await this.addStarredMessage(e,t),!0)}async isMessageStarred(e,t){return(this.data.starredMessages[e]??[]).includes(t)}async getCorpusBoard(){return this.data.corpusBoard}async addToCorpusBoard(e,t,s){const o={id:`corpus_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,text:e,conversationId:t,conversationTitle:s,addedAt:Date.now()};return this.data.corpusBoard.push(o),this.debouncedSave(),o}async removeFromCorpusBoard(e){this.data.corpusBoard=this.data.corpusBoard.filter(t=>t.id!==e),this.debouncedSave()}async clearCorpusBoard(){this.data.corpusBoard=[],this.debouncedSave()}async save(){this.saveTimer&&(clearTimeout(this.saveTimer),this.saveTimer=null),await this.persist()}}const A=new re;function ne(l,e){const t=Y(l.color),s=l.isExpanded;return`
    <div class="dbx-folder-item ${s?"expanded":""}" data-folder-id="${l.id}" data-folder-color="${l.color}">
      <div class="dbx-folder-row" data-folder-id="${l.id}">
        <div class="dbx-folder-expand-icon ${s?"expanded":""}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"></path>
          </svg>
        </div>
        <div class="dbx-folder-color-dot" style="background-color: ${t}"></div>
        <span class="dbx-folder-name">${_(l.name)}</span>
        <span class="dbx-folder-count">${e.length}</span>
        <button class="dbx-folder-menu-btn" title="更多操作">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"></circle>
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="12" cy="19" r="1.5"></circle>
          </svg>
        </button>
      </div>
      <div class="dbx-folder-contents" data-folder-id="${l.id}">
        ${e.map(o=>ie(o)).join("")}
      </div>
    </div>
  `}function ie(l){return`
    <div class="dbx-folder-conversation" data-conversation-id="${l.conversationId}">
      <div class="dbx-conversation-icon">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <span class="dbx-conversation-title">${_(l.title)}</span>
      <button class="dbx-folder-conversation-remove" title="从文件夹移除">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `}function ae(){return'<div class="dbx-folder-empty">暂无文件夹</div>'}function le(){return`
    <div id="dbx-folder-section" class="dbx-folder-section">
      <div class="dbx-folder-header">
        <div class="dbx-folder-title-row">
          <svg class="dbx-folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="dbx-folder-title">文件夹</span>
        </div>
        <button class="dbx-folder-add-btn" title="新建文件夹">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
        </button>
      </div>
      <div class="dbx-folder-list"></div>
    </div>
  `}function j(l,e){l.addEventListener("dragover",t=>{var s;t.preventDefault(),t.stopPropagation(),l.classList.add("dbx-drop-target"),(s=e.onDragOver)==null||s.call(e,t)}),l.addEventListener("dragleave",t=>{var s;t.preventDefault(),t.stopPropagation(),l.classList.remove("dbx-drop-target"),(s=e.onDragLeave)==null||s.call(e,t)}),l.addEventListener("drop",t=>{t.preventDefault(),t.stopPropagation(),l.classList.remove("dbx-drop-target");const s=l.dataset.folderId;s&&e.onDrop(s)})}function de(l,e,t){l.draggable=!0,l.addEventListener("dragstart",s=>{l.classList.add("dbx-dragging"),s.dataTransfer&&(s.dataTransfer.effectAllowed="move",s.dataTransfer.setData("application/json",JSON.stringify({type:"conversation",conversationId:e,title:t})))}),l.addEventListener("dragend",()=>{l.classList.remove("dbx-dragging")})}function ce(l){const e=document.createElement("div");return e.className="dbx-folder-indicator",e.style.backgroundColor=l,e.style.left="2px",e}function _(l){const e=document.createElement("div");return e.textContent=l,e.innerHTML}class ue{constructor(){x(this,"data",{folders:[],folderContents:{}});x(this,"containerElement",null);x(this,"sidebarContainer",null);x(this,"popupElement",null);x(this,"dragData",null);x(this,"initialized",!1);this.init=this.init.bind(this),this.render=this.render.bind(this)}async init(){await A.init(),this.data=await A.getData(),this.data.folders.forEach(e=>e.isExpanded=!1),await this.waitForSidebar(),this.findSidebarContainer(),this.render(),this.setupObservers(),this.addConversationIndicators(),this.initialized=!0}waitForSidebar(){return new Promise(e=>{if(document.querySelector('[data-testid="flow_chat_sidebar"]')){e();return}let s=0;const o=20,r=setInterval(()=>{(document.querySelector('[data-testid="flow_chat_sidebar"]')||s>=o)&&(clearInterval(r),e()),s++},250)})}findSidebarContainer(){this.sidebarContainer=document.querySelector('[data-testid="flow_chat_sidebar"]'),this.sidebarContainer&&(this.containerElement=this.sidebarContainer.querySelector("#dbx-folder-section"),this.containerElement?this.setupFolderEvents():this.createFolderSection())}createFolderSection(){if(!this.sidebarContainer)return;const e=this.sidebarContainer.querySelector('[data-testid="sidebar-section-item"]'),t=document.createElement("div");t.innerHTML=le();const s=t.firstElementChild;if(e&&e.parentNode)e.parentNode.insertBefore(s,e);else{const o=this.sidebarContainer.firstChild;o?this.sidebarContainer.insertBefore(s,o):this.sidebarContainer.appendChild(s)}this.containerElement=s,this.setupFolderEvents()}setupFolderEvents(){if(!this.containerElement)return;const e=this.containerElement.querySelector(".dbx-folder-add-btn");e&&e.addEventListener("click",t=>{t.stopPropagation(),this.showCreateFolderDialog(e)})}setupObservers(){const e=document.querySelector('[data-testid="flow_chat_sidebar"]');if(!e)return;let t=null;new MutationObserver(()=>{t&&clearTimeout(t),t=window.setTimeout(()=>{this.initialized?(document.querySelector("#dbx-folder-section")||(this.findSidebarContainer(),this.render()),this.addConversationIndicators(),this.setupFolderDropZones()):this.findSidebarContainer()},100)}).observe(e,{childList:!0,subtree:!0})}addConversationIndicators(){document.querySelectorAll('[data-testid="chat_list_thread_item"]').forEach(t=>{var a;const s=t;if(s.dataset.dvProcessed)return;s.dataset.dvProcessed="true";const o=s.id.match(/conversation_(\d+)/),r=o?o[1]:(a=s.getAttribute("href"))==null?void 0:a.replace("/chat/","");if(!r)return;const n=this.findConversationFolders(r);this.updateConversationIndicator(s,r,n),this.setupConversationDrag(s,r)}),this.setupFolderDropZones()}updateConversationIndicator(e,t,s){const o=e.querySelector(".dbx-folder-indicator");if(s.length>0){const r=this.data.folders.find(a=>a.id===s[0]),n=r?Y(r.color):"#6b7280";if(o)o.style.backgroundColor=n;else{const a=ce(n),i=e.querySelector(".wrapper-Xy3kj9")||e.querySelector("div:first-child")||e;i&&(i.style.position="relative",i.insertBefore(a,i.firstChild))}}else o&&o.remove()}refreshAllIndicators(){document.querySelectorAll('[data-testid="chat_list_thread_item"]').forEach(t=>{var a;const s=t,o=s.id.match(/conversation_(\d+)/),r=o?o[1]:(a=s.getAttribute("href"))==null?void 0:a.replace("/chat/","");if(!r)return;const n=this.findConversationFolders(r);this.updateConversationIndicator(s,r,n)})}setupConversationDrag(e,t){var r;if(e.dataset.dvDraggable==="true")return;e.dataset.dvDraggable="true";const s=e.querySelector('[class*="content"]')||e.querySelector("div"),o=((r=s==null?void 0:s.textContent)==null?void 0:r.trim())||"对话";de(e,t,o)}setupFolderDropZones(){document.querySelectorAll(".dbx-folder-contents").forEach(t=>{const s=t;if(s.dataset.dvDropZone==="true")return;s.dataset.dvDropZone="true";const o=s.dataset.folderId;o&&j(s,{onDrop:r=>this.handleDrop(r),onDragOver:()=>this.expandFolderOnDrag(o)})})}setupDropZoneForFolderRow(e,t){if(e.dataset.dvDropZoneRow==="true")return;e.dataset.dvDropZoneRow="true";const s=e.querySelector(".dbx-folder-row");s&&j(s,{onDrop:o=>this.handleDrop(o),onDragOver:()=>{e.classList.add("dbx-drop-target"),this.expandFolderOnDrag(t)},onDragLeave:()=>{e.classList.remove("dbx-drop-target")}})}expandFolderOnDrag(e){const t=this.data.folders.find(s=>s.id===e);t&&!t.isExpanded&&(t.isExpanded=!0,this.render())}findConversationFolders(e){const t=[];for(const[s,o]of Object.entries(this.data.folderContents))o.some(r=>r.conversationId===e)&&t.push(s);return t}render(){if(!this.containerElement)return;const e=this.containerElement.querySelector(".dbx-folder-list");if(e){if(this.data.folders.length===0){e.innerHTML=ae();return}e.innerHTML=this.data.folders.map(t=>{const s=this.data.folderContents[t.id]||[];return ne(t,s)}).join(""),this.setupFolderElementEvents(),this.setupFolderDropZones()}}setupFolderElementEvents(){var t;const e=(t=this.containerElement)==null?void 0:t.querySelectorAll(".dbx-folder-item");e==null||e.forEach(s=>{const o=s,r=o.dataset.folderId;if(!r)return;const n=o.querySelector(".dbx-folder-row");n&&n.addEventListener("click",i=>{i.target.closest(".dbx-folder-menu-btn")||this.toggleFolder(r)});const a=o.querySelector(".dbx-folder-menu-btn");a==null||a.addEventListener("click",i=>{i.stopPropagation(),this.showFolderMenu(r,a)}),this.setupDropZoneForFolderRow(o,r),o.querySelectorAll(".dbx-folder-conversation").forEach(i=>{const c=i;c.addEventListener("click",p=>{if(p.target.closest(".dbx-folder-conversation-remove"))return;p.stopPropagation();const v=c.dataset.conversationId;v&&(window.location.href=`/chat/${v}`)});const g=c.querySelector(".dbx-folder-conversation-remove");g==null||g.addEventListener("click",p=>{var y;p.stopPropagation();const T=c.dataset.conversationId,v=((y=c.querySelector(".dbx-conversation-title"))==null?void 0:y.textContent)||"对话";T&&this.showRemoveConfirm(r,T,v,g)})})})}showRemoveConfirm(e,t,s,o){var a,i;this.hidePopup();const r=o.getBoundingClientRect(),n=document.createElement("div");n.className="dbx-popup",n.innerHTML=`
      <div class="dbx-popup-content">
        <div class="dbx-popup-title">从文件夹移除</div>
        <div class="dbx-popup-message">确定要将"${_(s)}"从文件夹中移除吗？<br>对话不会被删除，仍在历史记录中。</div>
        <div class="dbx-popup-actions">
          <button class="dbx-popup-btn dbx-popup-btn-cancel">取消</button>
          <button class="dbx-popup-btn dbx-popup-btn-danger">移除</button>
        </div>
      </div>
    `,document.body.appendChild(n),this.popupElement=n,o&&(n.style.cssText=`
        position: fixed;
        left: ${r.left}px;
        top: ${r.bottom+8}px;
        background: transparent;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      `),(a=n.querySelector(".dbx-popup-btn-cancel"))==null||a.addEventListener("click",()=>this.hidePopup()),(i=n.querySelector(".dbx-popup-btn-danger"))==null||i.addEventListener("click",async()=>{await A.removeConversationFromFolder(e,t),this.data=await A.getData(),this.render(),this.refreshAllIndicators(),this.hidePopup()}),n.addEventListener("click",c=>{c.target===n&&this.hidePopup()})}handleDrop(e){var r,n,a;let t="",s="对话";const o=document.querySelector(".dbx-dragging");if(o){const i=o.id.match(/conversation_(\d+)/);t=i?i[1]:((r=o.getAttribute("href"))==null?void 0:r.replace("/chat/",""))||"";const c=o.querySelector('[class*="content"]')||o.querySelector("div");s=((n=c==null?void 0:c.textContent)==null?void 0:n.trim())||"对话"}(a=this.dragData)!=null&&a.conversationId&&(t=this.dragData.conversationId,s=this.dragData.title),t&&this.addConversationToFolder(e,t,s)}async addConversationToFolder(e,t,s){const o={conversationId:t,title:s,url:`/chat/${t}`,addedAt:Date.now()};await A.addConversationToFolder(e,o),this.data=await A.getData(),this.render(),this.refreshAllIndicators()}toggleFolder(e){const t=this.data.folders.find(s=>s.id===e);t&&(t.isExpanded=!t.isExpanded,this.render())}showCreateFolderDialog(e){var n,a,i;this.hidePopup();const t=document.createElement("div");if(t.className="dbx-popup",t.innerHTML=`
      <div class="dbx-popup-content">
        <div class="dbx-popup-title">新建文件夹</div>
        <input type="text" class="dbx-popup-input" placeholder="输入文件夹名称" maxlength="20">
        <div class="dbx-popup-color-label">选择颜色</div>
        <div class="dbx-popup-colors">
          ${this.getColorOptionsHTML("blue")}
        </div>
        <div class="dbx-popup-actions">
          <button class="dbx-popup-btn dbx-popup-btn-cancel">取消</button>
          <button class="dbx-popup-btn dbx-popup-btn-confirm">创建</button>
        </div>
      </div>
    `,document.body.appendChild(t),this.popupElement=t,e){const c=e.getBoundingClientRect();t.style.cssText=`
        position: fixed;
        left: ${c.left}px;
        top: ${c.bottom+8}px;
        background: transparent;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      `}const s=t.querySelector(".dbx-popup-input");s==null||s.focus();let o="blue";const r=t.querySelectorAll(".dbx-color-option");r.forEach(c=>{c.addEventListener("click",()=>{r.forEach(g=>g.classList.remove("selected")),c.classList.add("selected"),o=c.dataset.color||"blue"})}),(n=r[4])==null||n.classList.add("selected"),(a=t.querySelector(".dbx-popup-btn-cancel"))==null||a.addEventListener("click",()=>this.hidePopup()),(i=t.querySelector(".dbx-popup-btn-confirm"))==null||i.addEventListener("click",async()=>{const c=s.value.trim();if(!c)return;const g={id:`folder_${Date.now()}`,name:c,color:o,isExpanded:!1,createdAt:Date.now(),updatedAt:Date.now()};await A.addFolder(g),this.data=await A.getData(),this.render(),this.hidePopup()}),t.addEventListener("click",c=>{c.target===t&&this.hidePopup()})}getColorOptionsHTML(e){return[{id:"blue",value:"#3b82f6"},{id:"green",value:"#22c55e"},{id:"yellow",value:"#eab308"},{id:"orange",value:"#f97316"},{id:"red",value:"#ef4444"},{id:"purple",value:"#a855f7"},{id:"pink",value:"#ec4899"},{id:"gray",value:"#6b7280"}].map(s=>`<div class="dbx-color-option ${e===s.id?"selected":""}" data-color="${s.id}" style="background-color: ${s.value}"></div>`).join("")}showFolderMenu(e,t){this.hidePopup();const s=this.data.folders.find(n=>n.id===e);if(!s)return;const o=t.getBoundingClientRect(),r=document.createElement("div");r.className="dbx-folder-context-menu",r.style.cssText=`
      position: fixed;
      top: ${o.bottom+4}px;
      left: ${o.left-60}px;
      z-index: 10000;
    `,r.innerHTML=`
      <div class="dbx-folder-menu-item" data-action="rename">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>重命名</span>
      </div>
      <div class="dbx-folder-menu-item" data-action="color">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="13.5" cy="6.5" r="2.5"></circle>
          <circle cx="17.5" cy="10.5" r="2.5"></circle>
          <circle cx="8.5" cy="7.5" r="2.5"></circle>
          <circle cx="6.5" cy="12.5" r="2.5"></circle>
        </svg>
        <span>更换颜色</span>
      </div>
      <div class="dbx-folder-menu-item danger" data-action="delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span>删除</span>
      </div>
    `,document.body.appendChild(r),this.popupElement=r,r.querySelectorAll(".dbx-folder-menu-item").forEach(n=>{n.addEventListener("click",async a=>{a.stopPropagation();const i=n.dataset.action;this.hidePopup(),setTimeout(()=>{i==="rename"?this.showRenameDialog(s,t):i==="color"?this.showColorPicker(s,t):i==="delete"&&this.showDeleteConfirm(s,e,t)},50)})}),setTimeout(()=>{document.addEventListener("click",this.hidePopup.bind(this),{once:!0})},0)}showRenameDialog(e,t){var r,n;this.hidePopup();const s=document.createElement("div");if(s.className="dbx-popup",s.innerHTML=`
      <div class="dbx-popup-content">
        <div class="dbx-popup-title">重命名文件夹</div>
        <input type="text" class="dbx-popup-input" placeholder="输入新名称" maxlength="20" value="${e.name}">
        <div class="dbx-popup-actions">
          <button class="dbx-popup-btn dbx-popup-btn-cancel">取消</button>
          <button class="dbx-popup-btn dbx-popup-btn-confirm">确定</button>
        </div>
      </div>
    `,document.body.appendChild(s),this.popupElement=s,t){const a=t.getBoundingClientRect();s.style.cssText=`
        position: fixed;
        left: ${a.left}px;
        top: ${a.bottom+8}px;
        background: transparent;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      `}const o=s.querySelector(".dbx-popup-input");o==null||o.focus(),o==null||o.select(),(r=s.querySelector(".dbx-popup-btn-cancel"))==null||r.addEventListener("click",()=>this.hidePopup()),(n=s.querySelector(".dbx-popup-btn-confirm"))==null||n.addEventListener("click",async()=>{const a=o.value.trim();a&&(await A.updateFolder(e.id,{name:a}),this.data=await A.getData(),this.render(),this.hidePopup())}),s.addEventListener("click",a=>{a.target===s&&this.hidePopup()})}showColorPicker(e,t){this.hidePopup();const s=document.createElement("div");if(s.className="dbx-popup",s.innerHTML=`
      <div class="dbx-popup-content">
        <div class="dbx-popup-title">选择颜色</div>
        <div class="dbx-popup-colors dbx-popup-colors-lg">
          ${this.getColorOptionsHTML(e.color)}
        </div>
      </div>
    `,document.body.appendChild(s),this.popupElement=s,t){const n=t.getBoundingClientRect();s.style.cssText=`
        position: fixed;
        left: ${n.left}px;
        top: ${n.bottom+8}px;
        background: transparent;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      `}let o=e.color;const r=s.querySelectorAll(".dbx-color-option");r.forEach(n=>{n.addEventListener("click",async()=>{r.forEach(a=>a.classList.remove("selected")),n.classList.add("selected"),o=n.dataset.color||e.color,await A.updateFolder(e.id,{color:o}),this.data=await A.getData(),this.render(),this.refreshAllIndicators(),this.hidePopup()})}),s.addEventListener("click",n=>{n.target===s&&this.hidePopup()})}showDeleteConfirm(e,t,s){var r,n;this.hidePopup();const o=document.createElement("div");if(o.className="dbx-popup",o.innerHTML=`
      <div class="dbx-popup-content">
        <div class="dbx-popup-title">删除文件夹</div>
        <div class="dbx-popup-message">确定要删除"${e.name}"吗？</div>
        <div class="dbx-popup-actions">
          <button class="dbx-popup-btn dbx-popup-btn-cancel">取消</button>
          <button class="dbx-popup-btn dbx-popup-btn-danger">删除</button>
        </div>
      </div>
    `,document.body.appendChild(o),this.popupElement=o,s){const a=s.getBoundingClientRect();o.style.cssText=`
        position: fixed;
        left: ${a.left}px;
        top: ${a.bottom+8}px;
        background: transparent;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      `}else o.style.cssText=`
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      `;(r=o.querySelector(".dbx-popup-btn-cancel"))==null||r.addEventListener("click",()=>this.hidePopup()),(n=o.querySelector(".dbx-popup-btn-danger"))==null||n.addEventListener("click",async()=>{await A.deleteFolder(t),this.data=await A.getData(),this.render(),this.refreshAllIndicators(),this.hidePopup()}),o.addEventListener("click",a=>{a.target===o&&this.hidePopup()})}hidePopup(){this.popupElement&&(this.popupElement.remove(),this.popupElement=null)}destroy(){this.containerElement=null,this.sidebarContainer=null,this.hidePopup()}}const z=new ue;class ge{constructor(){x(this,"markers",[]);x(this,"locatorBar",null);x(this,"initialized",!1);x(this,"observer",null);x(this,"starredMarkers",new Set);x(this,"conversationId","");x(this,"tooltipEl",null);x(this,"hideTooltipTimeout",null);x(this,"debounceScan",this.debounce(()=>{this.scanMessages(),this.updateLocatorDots()},1e3))}get scrollContainer(){return document.querySelector('[data-testid="flow_chat_page"], [class*="chat-container"], main, [class*="page-main"]')}init(){this.initialized||(this.conversationId=this.getConversationId(),console.log("[QuickLocator] Conversation ID:",this.conversationId),this.waitForChatContainer(),this.initialized=!0)}getConversationId(){const e=window.location.pathname.match(/\/chat\/([^/?#]+)/);return e?e[1]:""}async waitForChatContainer(){let e=0;const t=30,s=async()=>{const o=this.scrollContainer;if(o||e>=t){o?(console.log("[QuickLocator] Chat container found, scanning messages..."),await this.loadStarredMessages(),this.scanMessages(),this.createLocatorBar(),this.setupObserver()):console.log("[QuickLocator] Chat container not found after max retries");return}e++,setTimeout(s,500)};s()}async loadStarredMessages(){if(!this.conversationId){console.log("[QuickLocator] No conversation ID, skipping starred messages load");return}try{const e=await A.getStarredMessages(this.conversationId);this.starredMarkers=new Set(e),console.log("[QuickLocator] Loaded starred messages:",this.starredMarkers)}catch(e){console.error("[QuickLocator] Failed to load starred messages:",e)}}scanMessages(){const e=this.scrollContainer;if(!e){console.log("[QuickLocator] scrollContainer not found");return}const t=e.querySelectorAll('[data-testid="message_text_content"]');console.log("[QuickLocator] Found message contents:",t.length);const s=[];t.forEach(o=>{var n;const r=o.closest('[data-testid="union_message"]')||o.closest('[class*="item"]');r&&!s.includes(r)&&((((n=r.innerHTML)==null?void 0:n.toLowerCase())||"").includes("receive_message")||s.push(r))}),console.log("[QuickLocator] Found user messages:",s.length),this.markers=s.slice(0,20).map((o,r)=>{const n=this.extractMessageText(o);return{id:`marker_${r}`,element:o,text:n||`问题 ${r+1}`,index:r,starred:this.starredMarkers.has(r)}}).filter(o=>o.text&&o.text.length>0),console.log("[QuickLocator] Found markers:",this.markers.length),this.updateLocatorDots()}extractMessageText(e){var r;const t=e.cloneNode(!0);["svg","button",'[class*="avatar"]','[class*="time"]','[class*="timestamp"]','[class*="meta"]','[class*="action"]','[class*="toolbar"]','[data-testid*="action"]'].forEach(n=>{t.querySelectorAll(n).forEach(a=>a.remove())});let o=((r=t.textContent)==null?void 0:r.trim())||"";return o=o.replace(/\s+/g," ").trim(),o.length>40?o.substring(0,40)+"...":o}createLocatorBar(){if(this.locatorBar)return;console.log("[QuickLocator] Creating locator bar");const e=document.createElement("div");e.id="dbx-quick-locator",e.innerHTML=`
      <div class="dbx-locator-track"></div>
    `,document.body.appendChild(e),this.locatorBar=e,console.log("[QuickLocator] Locator bar created, markers:",this.markers.length),this.updateLocatorDots()}updateLocatorDots(){if(!this.locatorBar)return;const e=this.locatorBar.querySelector(".dbx-locator-track");e&&(e.innerHTML="",this.markers.forEach((t,s)=>{const o=document.createElement("button");o.className="dbx-locator-dot"+(t.starred?" starred":""),o.setAttribute("data-marker-index",String(s)),o.setAttribute("data-marker-text",t.text),o.addEventListener("mouseenter",r=>{this.showTooltip(r.target,t)}),o.addEventListener("mouseleave",r=>{const n=r.relatedTarget;(!this.tooltipEl||!this.tooltipEl.contains(n))&&this.hideTooltip()}),o.addEventListener("click",()=>{this.scrollToMessage(t)}),e.appendChild(o)}))}showTooltip(e,t){this.hideTooltipTimeout&&(clearTimeout(this.hideTooltipTimeout),this.hideTooltipTimeout=null),this.tooltipEl||(this.tooltipEl=document.createElement("div"),this.tooltipEl.id="dbx-locator-tooltip-floating",this.tooltipEl.style.cssText="position: fixed; z-index: 99999; background: #fff; color: #333; padding: 10px 12px; border-radius: 10px; font-size: 13px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); width: 240px; height: 90px; display: none; flex-direction: column; gap: 8px; overflow: hidden;",document.body.appendChild(this.tooltipEl),this.tooltipEl.addEventListener("mouseenter",()=>{this.hideTooltipTimeout&&(clearTimeout(this.hideTooltipTimeout),this.hideTooltipTimeout=null)}),this.tooltipEl.addEventListener("mouseleave",()=>{this.hideTooltip()}));const s=this.tooltipEl.querySelector(".tooltip-text");if(s)s.textContent=t.text;else{const n=document.createElement("div");n.className="tooltip-text",n.textContent=t.text,n.style.cssText="color: #333; line-height: 1.4; height: 54px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; word-wrap: break-word; word-break: break-all;",this.tooltipEl.appendChild(n)}let o=this.tooltipEl.querySelector(".tooltip-star");o||(o=document.createElement("button"),o.className="tooltip-star",o.style.cssText="display: flex; align-items: center; justify-content: flex-start; gap: 6px; padding: 6px 8px; margin: 0 -4px; border-radius: 6px; font-size: 12px; color: #666; cursor: pointer; background: transparent; border: none; width: fit-content;",this.tooltipEl.appendChild(o)),o.innerHTML=`
      <svg width="12" height="12" viewBox="0 0 24 24" fill="${t.starred?"currentColor":"none"}" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
      ${t.starred?"已收藏":"收藏"}
    `,o.onclick=async n=>{var c;n.stopPropagation();const a=!t.starred;o.innerHTML=`
        <svg width="12" height="12" viewBox="0 0 24 24" fill="${a?"currentColor":"none"}" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        ${a?"已收藏":"收藏"}
      `,o.style.color=a?"#f59e0b":"#666";const i=(c=this.locatorBar)==null?void 0:c.querySelector(`[data-marker-index="${t.index}"]`);if(i&&i.classList.toggle("starred",a),this.starredMarkers.has(t.index)?this.starredMarkers.delete(t.index):this.starredMarkers.add(t.index),this.markers[t.index].starred=a,this.conversationId)try{a?await A.addStarredMessage(this.conversationId,t.index):await A.removeStarredMessage(this.conversationId,t.index),console.log("[QuickLocator] Saved starred message:",t.index,a)}catch(g){console.error("[QuickLocator] Failed to save starred message:",g)}};const r=e.getBoundingClientRect();this.tooltipEl.style.display="flex",this.tooltipEl.style.left=r.left-240+"px",this.tooltipEl.style.top=r.top+r.height/2-35+"px"}hideTooltip(){this.hideTooltipTimeout||(this.hideTooltipTimeout=window.setTimeout(()=>{this.tooltipEl&&(this.tooltipEl.style.display="none"),this.hideTooltipTimeout=null},150))}scrollToMessage(e){e.element&&(e.element.scrollIntoView({behavior:"smooth",block:"center"}),e.element.classList.add("dbx-message-highlight"),setTimeout(()=>{e.element.classList.remove("dbx-message-highlight")},2e3))}setupObserver(){const e=this.scrollContainer;e&&(this.observer=new MutationObserver(t=>{let s=!1;for(const o of t)if(o.addedNodes.length>0){s=!0;break}s&&this.debounceScan()}),this.observer.observe(e,{childList:!0,subtree:!0}))}debounce(e,t){let s=null;return()=>{s&&clearTimeout(s),s=window.setTimeout(e,t)}}destroy(){this.observer&&(this.observer.disconnect(),this.observer=null),this.locatorBar&&(this.locatorBar.remove(),this.locatorBar=null),this.markers=[],this.initialized=!1}}const U=new ge;class pe{constructor(){x(this,"triggerBtn",null);x(this,"panel",null);x(this,"initialized",!1);x(this,"isExpanded",!1);x(this,"isDragging",!1);x(this,"dragOffsetX",0);x(this,"dragOffsetY",0);x(this,"positionX",0);x(this,"positionY",0);x(this,"corpusItems",[]);x(this,"handleOutsideClick",e=>{this.panel&&!this.panel.contains(e.target)&&this.triggerBtn&&!this.triggerBtn.contains(e.target)&&(this.isExpanded=!1,this.hidePanel())})}init(){this.initialized||(console.log("[CorpusBoard] Initializing..."),this.loadCorpusItems(),this.createTriggerButton(),this.setupTextSelectionListener(),this.initialized=!0,console.log("[CorpusBoard] Initialized, trigger button:",this.triggerBtn),setTimeout(()=>{this.recalculatePosition()},2e3))}recalculatePosition(){console.log("[CorpusBoard] Recalculating position after delay...");const e=this.getDefaultPosition();console.log("[CorpusBoard] New default position:",e),console.log("[CorpusBoard] Current position:",{x:this.positionX,y:this.positionY}),console.log("[CorpusBoard] Should update (newPos.x > 1000):",e.x>1e3),e.x>1e3?(this.positionX=e.x,this.positionY=e.y,this.applyTriggerPosition(),console.log("[CorpusBoard] Position updated to:",e)):console.log("[CorpusBoard] Position NOT updated, using current")}async loadCorpusItems(){try{this.corpusItems=await A.getCorpusBoard()}catch(e){console.error("[CorpusBoard] Failed to load corpus items:",e)}}createTriggerButton(){var t;if(this.triggerBtn)return;console.log("[CorpusBoard] Creating trigger button..."),console.log("[CorpusBoard] document.body exists:",!!document.body);const e=this.loadPosition();this.positionX=e.x,this.positionY=e.y,this.triggerBtn=document.createElement("div"),this.triggerBtn.id="dbx-corpus-trigger",this.triggerBtn.innerHTML=`
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
      <span class="dbx-corpus-count">${this.corpusItems.length}</span>
    `,this.applyTriggerPosition(),this.triggerBtn.style.cssText=this.getTriggerStyles(),this.triggerBtn.style.display="flex",console.log("[CorpusBoard] Trigger button created, in DOM:",(t=document.body)==null?void 0:t.contains(this.triggerBtn)),this.triggerBtn.addEventListener("click",s=>{this.isDragging||this.togglePanel()}),this.setupDrag(),document.body.appendChild(this.triggerBtn),console.log("[CorpusBoard] Trigger button appended to body")}getTriggerStyles(){return`
      position: fixed;
      z-index: 9998;
      width: 44px;
      height: 44px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      color: #666;
      transition: box-shadow 0.2s, transform 0.1s;
      user-select: none;
    `}applyTriggerPosition(){this.triggerBtn&&(this.triggerBtn.style.right="auto",this.triggerBtn.style.bottom="auto",this.triggerBtn.style.left=`${this.positionX}px`,this.triggerBtn.style.top=`${this.positionY}px`)}getDefaultPosition(){console.log("[CorpusBoard] Calculating default position...");const e=this.findInputArea();if(console.log("[CorpusBoard] inputArea found:",!!e),e){const o=e.getBoundingClientRect();return console.log("[CorpusBoard] inputArea rect:",o),{x:o.right+16,y:o.top}}const t=document.querySelector("#dbx-quick-locator");if(console.log("[CorpusBoard] locatorBar found:",!!t),t){const o=t.getBoundingClientRect();return console.log("[CorpusBoard] locatorBar rect:",o),{x:o.right+16,y:o.top}}const s={x:window.innerWidth-70,y:window.innerHeight-200};return console.log("[CorpusBoard] Using fallback position:",s),s}loadPosition(){const e=this.getDefaultPosition();console.log("[CorpusBoard] Default position calculated:",e);try{const t=localStorage.getItem("dbx_corpus_trigger_pos");if(console.log("[CorpusBoard] Loaded position from localStorage:",t),t){const s=JSON.parse(t),o=e.x>1e3;if(s.x>=0&&s.x<window.innerWidth&&s.y>=0&&s.y<window.innerHeight)return o?(console.log("[CorpusBoard] Default is near QuickLocator, using default position"),e):(console.log("[CorpusBoard] Using saved position:",s),s);console.log("[CorpusBoard] Saved position out of bounds, recalculating"),localStorage.removeItem("dbx_corpus_trigger_pos")}}catch(t){console.log("[CorpusBoard] Error loading position:",t)}return console.log("[CorpusBoard] Using default position"),e}savePosition(){try{localStorage.setItem("dbx_corpus_trigger_pos",JSON.stringify({x:this.positionX,y:this.positionY}))}catch{}}setupDrag(){if(!this.triggerBtn)return;const e=t=>{if(this.isExpanded){t.preventDefault();return}if(t.target.closest(".dbx-corpus-panel"))return;this.isDragging=!1;const o=t.clientX,r=t.clientY,n=this.triggerBtn.getBoundingClientRect();this.dragOffsetX=o-n.left,this.dragOffsetY=r-n.top;const a=c=>{const g=Math.abs(c.clientX-o),p=Math.abs(c.clientY-r);(g>5||p>5)&&(this.isDragging=!0),this.isDragging&&(this.positionX=c.clientX-this.dragOffsetX,this.positionY=c.clientY-this.dragOffsetY,this.applyTriggerPosition())},i=()=>{document.removeEventListener("mousemove",a),document.removeEventListener("mouseup",i),this.isDragging&&this.savePosition()};document.addEventListener("mousemove",a),document.addEventListener("mouseup",i)};this.triggerBtn.addEventListener("mousedown",e)}togglePanel(){this.isExpanded=!this.isExpanded,this.isExpanded?(this.createPanel(),this.updatePanelContent()):this.hidePanel()}createPanel(){this.panel||(this.panel=document.createElement("div"),this.panel.className="dbx-corpus-panel",this.panel.style.cssText=this.getPanelStyles(),document.body.appendChild(this.panel),document.addEventListener("click",this.handleOutsideClick))}getPanelStyles(){var n;const e=(n=this.triggerBtn)==null?void 0:n.getBoundingClientRect(),t=300,s=400;let o=e?e.left-t-8:this.positionX-t-8,r=e?e.top:this.positionY;return o<8&&(o=e?e.right+8:this.positionX+60),o+t>window.innerWidth-8&&(o=window.innerWidth-t-8),r<8&&(r=e?e.bottom+8:this.positionY+60),r+s>window.innerHeight-8&&(r=window.innerHeight-s-8),`
      position: fixed;
      z-index: 9999;
      left: ${o}px;
      top: ${r}px;
      width: ${t}px;
      max-height: ${s}px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `}updatePanelContent(){var t,s;if(!this.panel)return;const e=this.corpusItems.length;this.panel.innerHTML=`
      <div class="dbx-corpus-header">
        <span class="dbx-corpus-title">语料板</span>
        <span class="dbx-corpus-header-count">${e} 条</span>
        <button class="dbx-corpus-clear-btn" title="清空">清空</button>
      </div>
      <div class="dbx-corpus-list">
        ${this.corpusItems.length===0?'<div class="dbx-corpus-empty">暂无语料<br><small>选中文本后右键添加到语料板</small></div>':""}
        ${this.corpusItems.map(o=>`
          <div class="dbx-corpus-item" data-id="${o.id}">
            <div class="dbx-corpus-item-content">${this.escapeHtml(o.text)}</div>
            <div class="dbx-corpus-item-meta">
              <span class="dbx-corpus-item-source">${this.escapeHtml(o.conversationTitle||"未知对话")}</span>
              <button class="dbx-corpus-item-remove" title="删除">×</button>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="dbx-corpus-footer">
        <button class="dbx-corpus-add-btn" ${e===0?"disabled":""}>添加到对话框</button>
      </div>
    `,this.updateTriggerCount(),(t=this.panel.querySelector(".dbx-corpus-clear-btn"))==null||t.addEventListener("click",()=>{this.clearCorpus()}),this.panel.querySelectorAll(".dbx-corpus-item-remove").forEach(o=>{o.addEventListener("click",r=>{var a;const n=(a=r.target.closest(".dbx-corpus-item"))==null?void 0:a.getAttribute("data-id");n&&this.removeCorpusItem(n)})}),(s=this.panel.querySelector(".dbx-corpus-add-btn"))==null||s.addEventListener("click",()=>{this.addToInput()})}escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}updateTriggerCount(){var t;const e=(t=this.triggerBtn)==null?void 0:t.querySelector(".dbx-corpus-count");e&&(e.textContent=String(this.corpusItems.length))}hidePanel(){this.panel&&(this.panel.remove(),this.panel=null),document.removeEventListener("click",this.handleOutsideClick)}setupTextSelectionListener(){let e=null,t=null,s="";console.log("[CorpusBoard] Setting up text selection listener");const o=(r,n)=>{if(console.log("[CorpusBoard] showSelectionButton called",n),!n||n.trim().length===0){e&&(e.style.display="none");return}s=n,console.log("[CorpusBoard] Saved selection text:",s);const i=r.getRangeAt(0).getBoundingClientRect();console.log("[CorpusBoard] Selection rect:",i),e||(e=document.createElement("div"),e.className="dbx-corpus-selection-btn",e.innerHTML=`
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          添加到语料板
        `,e.style.cssText=`
          position: fixed;
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: #4f46e5;
          color: #fff;
          font-size: 12px;
          font-weight: 500;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
          cursor: pointer;
          white-space: nowrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `,e.addEventListener("click",T=>{T.stopPropagation(),console.log("[CorpusBoard] Button clicked, saved text:",s),s&&(this.addToCorpus(s),this.flashTriggerButton()),e.style.display="none",s=""}),document.body.appendChild(e));const c=e.getBoundingClientRect(),g=i.left+i.width/2-c.width/2,p=i.bottom+8;e.style.left=`${Math.max(8,g)}px`,e.style.top=`${Math.min(p,window.innerHeight-40)}px`,e.style.display="flex"};document.addEventListener("mouseup",r=>{t&&(clearTimeout(t),t=null);const n=r.target;if(n.closest(".dbx-corpus-panel")||n.closest(".dbx-corpus-trigger")||n.closest(".dbx-corpus-selection-btn"))return;const a=window.getSelection(),i=(a==null?void 0:a.toString().trim())||"";if(console.log("[CorpusBoard] mouseup, selection text:",i),i.length>0){const g=a.getRangeAt(0).commonAncestorContainer,p=g.nodeType===Node.TEXT_NODE?g.parentElement:g;if(p){console.log("[CorpusBoard] Selection container:",p.tagName,p.className);const T=['input[type="text"]',"input:not([type])","textarea",'[contenteditable="true"]'];for(const m of T)if(p.matches(m)||p.closest(m)){console.log("[CorpusBoard] Selection in excluded element:",m),e&&(e.style.display="none");return}let v=p,y=0;for(;v&&y<5;){const m=v.className||"";if(typeof m=="string"&&(m.includes("flex-col-reverse")||m.includes("items-end")||m.includes("input-area")||m.includes("composer"))){console.log("[CorpusBoard] Selection in input area parent:",m),e&&(e.style.display="none");return}v=v.parentElement,y++}}o(a,i)}else t=window.setTimeout(()=>{e&&(e.style.display="none")},200)}),document.addEventListener("mousedown",r=>{!r.target.closest(".dbx-corpus-selection-btn")&&e&&(e.style.display="none")})}flashTriggerButton(){this.triggerBtn&&(this.triggerBtn.style.transform="scale(1.2)",this.triggerBtn.style.boxShadow="0 0 0 4px rgba(79, 70, 229, 0.3)",setTimeout(()=>{this.triggerBtn&&(this.triggerBtn.style.transform="scale(1)",this.triggerBtn.style.boxShadow="")},300))}async addToCorpus(e){console.log("[CorpusBoard] addToCorpus called with text:",e);const t=this.getConversationId(),s=this.getConversationTitle();console.log("[CorpusBoard] conversationId:",t,"conversationTitle:",s);try{console.log("[CorpusBoard] Calling storageService.addToCorpusBoard...");const o=await A.addToCorpusBoard(e,t,s);console.log("[CorpusBoard] Item added:",o),this.corpusItems.push(o),this.updateTriggerCount(),this.isExpanded&&this.panel&&this.updatePanelContent()}catch(o){console.error("[CorpusBoard] Failed to add corpus:",o)}}async removeCorpusItem(e){try{await A.removeFromCorpusBoard(e),this.corpusItems=this.corpusItems.filter(t=>t.id!==e),this.updateTriggerCount(),this.isExpanded&&this.panel&&this.updatePanelContent()}catch(t){console.error("[CorpusBoard] Failed to remove corpus:",t)}}async clearCorpus(){try{await A.clearCorpusBoard(),this.corpusItems=[],this.updateTriggerCount(),this.isExpanded&&this.panel&&this.updatePanelContent()}catch(e){console.error("[CorpusBoard] Failed to clear corpus:",e)}}async addToInput(){if(this.corpusItems.length===0)return;const e=this.corpusItems.map(s=>`[${s.text}]`).join(`
`),t=this.findInputArea();if(t){const s=t.querySelector("textarea"),o=t.querySelector('div[contenteditable="true"]');if(s){const r=s.value;s.value=r+(r?`
`:"")+e,s.dispatchEvent(new Event("input",{bubbles:!0}))}else if(o){const r=o.textContent||"";o.textContent=r+(r?`
`:"")+e,o.dispatchEvent(new InputEvent("input",{bubbles:!0}))}}this.isExpanded=!1,this.hidePanel()}findInputArea(){const e=[".relative.flex.flex-col-reverse.justify-between.items-end",".flex-col-reverse.items-end.p-10",'[class*="flex-col-reverse"][class*="items-end"]','[class*="p-10"][class*="flex-col-reverse"]','[class*="justify-between"][class*="flex-col-reverse"]','[data-testid="send_textarea"]','textarea[placeholder*="发送"]','div[contenteditable="true"]','[class*="input"]','[class*="composer"]','[class*="chat-input"]'];for(const t of e){const s=document.querySelector(t);if(s)return console.log("[CorpusBoard] findInputArea found:",t),s}return console.log("[CorpusBoard] findInputArea: no element found"),null}getConversationId(){const e=window.location.pathname.match(/\/chat\/([^/?#]+)/);return e?e[1]:""}getConversationTitle(){var t;const e=document.querySelector('[class*="title"], [class*="header"] h1, h1');return((t=e==null?void 0:e.textContent)==null?void 0:t.trim())||"未知对话"}destroy(){this.triggerBtn&&(this.triggerBtn.remove(),this.triggerBtn=null),this.panel&&(this.panel.remove(),this.panel=null),this.initialized=!1}}const X=new pe;class he{constructor(){x(this,"initialized",!1);x(this,"exportButton",null);x(this,"dropdownMenu",null)}init(){if(this.initialized){this.ensureButtonVisible();return}console.log("[ExportManager] Initializing..."),this.waitForTopbar(),this.ensureButtonVisible(),this.initialized=!0}ensureButtonVisible(){setTimeout(()=>{const e=document.getElementById("dbx-export-btn");if(!e){this.waitForTopbar();return}const t=document.querySelector('[class*="header-height"]')||document.querySelector("header")||document.querySelector('[class*="border-b"]');t&&!t.contains(e)&&(e.remove(),this.exportButton=null,this.addExportButton(t))},1e3)}waitForTopbar(){const e=()=>{const t=document.querySelector('[class*="header-height"]')||document.querySelector("header")||document.querySelector('[class*="border-b"]');t?(console.log("[ExportManager] Topbar found, adding export button"),this.addExportButton(t)):setTimeout(e,500)};e()}addExportButton(e){if(document.getElementById("dbx-export-btn"))return;this.exportButton=document.createElement("button"),this.exportButton.id="dbx-export-btn",this.exportButton.innerHTML=`
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `,this.exportButton.style.cssText=`
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 4px;
      color: var(--dbx-text-primary, #1f2937);
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `,this.exportButton.setAttribute("data-dbx-name","button"),this.exportButton.setAttribute("data-disabled","false"),this.exportButton.addEventListener("mouseenter",()=>{this.exportButton.style.backgroundColor="var(--dbx-fill-trans-20-hover, rgba(0, 0, 0, 0.05))"}),this.exportButton.addEventListener("mouseleave",()=>{this.exportButton.style.backgroundColor="transparent"}),this.exportButton.addEventListener("click",o=>{o.stopPropagation(),this.toggleDropdown()});const s=e.querySelector('div[class*="flex-row"]');s?s.appendChild(this.exportButton):e.appendChild(this.exportButton),document.addEventListener("click",o=>{var r;this.dropdownMenu&&!this.dropdownMenu.contains(o.target)&&!((r=this.exportButton)!=null&&r.contains(o.target))&&this.hideDropdown()})}toggleDropdown(){this.dropdownMenu&&this.dropdownMenu.style.display==="flex"?this.hideDropdown():this.showDropdown()}showDropdown(){if(!this.dropdownMenu){this.dropdownMenu=document.createElement("div"),this.dropdownMenu.id="dbx-export-dropdown",this.dropdownMenu.style.cssText=`
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        min-width: 140px;
        background: var(--dbx-folder-bg-base, #fff);
        border: 1px solid var(--dbx-line-7, #e5e7eb);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        z-index: 10000;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;const t=this.createDropdownItem("导出为 PDF",()=>this.exportToPdf()),s=this.createDropdownItem("导出为 TXT",()=>this.exportToTxt()),o=this.createDropdownItem("导出为 Markdown",()=>this.exportToMarkdown());this.dropdownMenu.appendChild(t),this.dropdownMenu.appendChild(s),this.dropdownMenu.appendChild(o)}const e=this.exportButton.getBoundingClientRect();this.dropdownMenu.style.position="fixed",this.dropdownMenu.style.left=`${e.left}px`,this.dropdownMenu.style.top=`${e.bottom}px`,this.dropdownMenu.style.display="flex",document.body.appendChild(this.dropdownMenu)}hideDropdown(){this.dropdownMenu&&(this.dropdownMenu.style.display="none")}createDropdownItem(e,t){const s=document.createElement("button");return s.textContent=e,s.style.cssText=`
      display: block;
      width: 100%;
      padding: 10px 16px;
      font-size: 14px;
      color: var(--dbx-text-primary, #1f2937);
      background: transparent;
      border: none;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.15s ease;
    `,s.addEventListener("mouseenter",()=>{s.style.backgroundColor="var(--dbx-fill-trans-20-hover, rgba(0, 0, 0, 0.05))"}),s.addEventListener("mouseleave",()=>{s.style.backgroundColor="transparent"}),s.addEventListener("click",o=>{o.stopPropagation(),this.hideDropdown(),t()}),s}async getConversationMessages(){const e=[],t=document.querySelector('[data-testid="flow_chat_page"], [class*="chat-container"], main, [class*="page-main"]');if(!t)return console.log("[ExportManager] Chat container not found"),e;const s=t.querySelectorAll('[data-testid="message_text_content"]');return console.log("[ExportManager] Found message elements:",s.length),s.forEach(o=>{var T,v;const r=o.closest('[data-testid="union_message"]')||o.closest('[class*="item"]')||o.closest('[class*="message"]');if(!r)return;const a=(((T=r.innerHTML)==null?void 0:T.toLowerCase())||"").includes("receive_message")?"assistant":"user",i=r.cloneNode(!0);["svg","button",'[class*="avatar"]','[class*="time"]','[class*="tool"]',"script","style"].forEach(y=>{i.querySelectorAll(y).forEach(m=>m.remove())});let g="";const p=i.querySelectorAll("img").length>0;p?(i.querySelectorAll("img").forEach(m=>{const C=m.getAttribute("src")||m.getAttribute("data-src")||"";C&&(C.startsWith("data:")||C.startsWith("http")?m.setAttribute("src",C):(C.startsWith("//")||C.startsWith("/"))&&m.setAttribute("src","https:"+C))}),g=i.innerHTML.trim()):g=((v=i.textContent)==null?void 0:v.trim())||"",g&&(typeof g=="string"?g.length>0:g!=="")&&e.push({id:`msg_${e.length}`,role:a,content:g,hasImages:p})}),console.log("[ExportManager] Found messages:",e.length,"user:",e.filter(o=>o.role==="user").length,"assistant:",e.filter(o=>o.role==="assistant").length,"with images:",e.filter(o=>o.hasImages).length),e}getConversationTitle(){var s;const e=document.querySelector('[class*="title"], [data-testid*="title"], h1');if(e)return((s=e.textContent)==null?void 0:s.trim())||"对话导出";const t=window.location.pathname.match(/\/chat\/([^/?#]+)/);return t?`对话_${t[1].substring(0,8)}`:"对话导出"}async exportToPdf(){console.log("[ExportManager] Exporting to PDF...");const e=await this.getConversationMessages(),t=this.getConversationTitle(),s=e.filter(i=>i.role==="user"),o=e.filter(i=>i.role==="assistant"),r=(i,c)=>{if(!c)return this.escapeHtml(i);const g=document.createElement("div");g.innerHTML=i;const p=g.querySelectorAll("img");if(p.length===0)return this.escapeHtml(i);const T=Array.from(p),v=document.createElement("div");let y="";if(g.childNodes.forEach(m=>{if(m.nodeType===Node.TEXT_NODE)y+=m.textContent;else if(m.nodeType===Node.ELEMENT_NODE){const C=m;C.tagName!=="IMG"&&(y+=C.textContent)}}),y.trim()){const m=document.createElement("div");m.textContent=y.trim(),m.style.marginBottom="12px",v.appendChild(m)}return T.forEach(m=>{const C=m.getAttribute("src")||m.getAttribute("data-src")||"";if(!C)return;const L=C.toLowerCase();if(L.includes("data:image/svg")||L.includes("width=2048")||L.includes('width="2048'))return;const D=document.createElement("img");D.src=C,D.style.cssText="max-width: 200px; height: auto; border-radius: 4px; margin: 4px; display: inline-block; vertical-align: top;",D.onerror=function(){this.style.display="none"},v.appendChild(D)}),v.innerHTML},n=`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${t}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 13px;
            line-height: 1.5;
            color: #1f2937;
            background: #fff;
            padding: 20px;
            max-width: 100%;
          }
          h1 {
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 16px 0;
            padding-bottom: 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          .meta {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 20px;
          }
          .conversation {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .message {
            padding: 12px;
            border-radius: 8px;
            break-inside: avoid;
          }
          .message-user {
            background: #f3f4f6;
            margin-right: 40px;
          }
          .message-assistant {
            background: #f9fafb;
            margin-left: 40px;
          }
          .role {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .message-user .role {
            color: #4b5563;
          }
          .message-assistant .role {
            color: #6b7280;
          }
          .content {
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          @media print {
            body {
              padding: 0;
            }
            .message {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <h1>${t}</h1>
        <div class="meta">共 ${e.length} 条消息（用户: ${s.length}, AI: ${o.length}）</div>
        <div class="conversation">
          ${e.map(i=>`
            <div class="message message-${i.role}">
              <div class="role">${i.role==="user"?"用户":"AI"}</div>
              <div class="content">${r(i.content,!!i.hasImages)}</div>
            </div>
          `).join("")}
        </div>
      </body>
      </html>
    `,a=window.open("","_blank");a&&(a.document.write(n),a.document.close(),setTimeout(()=>{a.print()},250))}async exportToTxt(){console.log("[ExportManager] Exporting to TXT...");const e=await this.getConversationMessages(),t=this.getConversationTitle(),s=new Date().toLocaleDateString("zh-CN"),o=e.filter(i=>i.role==="user").length,r=e.filter(i=>i.role==="assistant").length,n=i=>{const c=/<img[^>]+src=["']([^"']+)["'][^>]*>/gi,g=[];let p;for(;(p=c.exec(i))!==null;)g.push(p[1]);return g},a=[t,"─".repeat(40),`导出日期: ${s}`,`共 ${e.length} 条消息（用户: ${o}, AI: ${r}）`,"",...e.map(i=>{const c=i.role==="user"?"【用户】":"【AI】";let g=i.hasImages?this.extractTextFromHtml(i.content):i.content;if(i.hasImages){const p=n(i.content);p.length>0&&(g+=`

[图片: `+p.join(", ")+"]")}return`${c}
${g}
`})].join(`
`);this.downloadFile(a,`${t}.txt`,"text/plain;charset=utf-8")}extractTextFromHtml(e){const t=document.createElement("div");return t.innerHTML=e,t.textContent||t.innerText||""}async exportToMarkdown(){console.log("[ExportManager] Exporting to Markdown...");const e=await this.getConversationMessages(),t=this.getConversationTitle(),s=new Date().toLocaleDateString("zh-CN"),o=e.filter(i=>i.role==="user").length,r=e.filter(i=>i.role==="assistant").length,n=i=>{const c=/<img[^>]+src=["']([^"']+)["'][^>]*>/gi,g=[];let p;for(;(p=c.exec(i))!==null;)g.push(p[1]);return g},a=[`# ${t}`,"",`> 导出日期: ${s}`,`> 共 ${e.length} 条消息（用户: ${o}, AI: ${r}）`,"","---","",...e.map(i=>{const c=i.role==="user"?"**用户**":"**AI**";let g=i.hasImages?this.extractTextFromHtml(i.content):i.content,p=`### ${c}

${g}`;return i.hasImages&&n(i.content).forEach(v=>{p+=`

![图片](${v})`}),p})].join(`
`);this.downloadFile(a,`${t}.md`,"text/markdown;charset=utf-8")}downloadFile(e,t,s){const o=new Blob([e],{type:s}),r=URL.createObjectURL(o),n=document.createElement("a");n.href=r,n.download=t,document.body.appendChild(n),n.click(),document.body.removeChild(n),URL.revokeObjectURL(r)}escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}}const W=new he;async function me(){await A.init(),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{z.init(),U.init(),X.init(),W.init()}):(z.init(),U.init(),X.init(),W.init())}me();
})()
