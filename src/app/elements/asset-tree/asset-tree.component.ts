import {Component, Input, OnInit, OnDestroy, ElementRef, ViewChild} from '@angular/core';
import {MatDialog} from '@angular/material';
import {BehaviorSubject} from 'rxjs';
import {ActivatedRoute} from '@angular/router';

import {AppService, HttpService, LogService, NavService, TreeFilterService} from '@app/app.service';
import {connectEvt, translate} from '@app/globals';
import {TreeNode, ConnectEvt} from '@app/model';

declare var $: any;

@Component({
  selector: 'elements-asset-tree',
  templateUrl: './asset-tree.component.html',
  styleUrls: ['./asset-tree.component.scss'],
})
export class ElementAssetTreeComponent implements OnInit, OnDestroy {
  @Input() query: string;
  @Input() searchEvt$: BehaviorSubject<string>;
  @ViewChild('rMenu') rMenu: ElementRef;
  Data = [];
  nodes = [];
  setting = {
    view: {
      dblClickExpand: false,
      showLine: true
    },
    data: {
      simpleData: {
        enable: true
      },
      key: {
        title: 'title'
      }
    },
  };
  pos = {left: '100px', top: '200px'};
  hiddenNodes: any;
  expandNodes: any;
  assetsTree: any;
  remoteAppsTree: any;
  isShowRMenu = false;
  rightClickSelectNode: any;
  hasLoginTo = false;
  treeFilterSubscription: any;

  constructor(private _appSvc: AppService,
              private _treeFilterSvc: TreeFilterService,
              public _dialog: MatDialog,
              public _logger: LogService,
              private activatedRoute: ActivatedRoute,
              private _http: HttpService,
              private _navSvc: NavService
  ) {}

  ngOnInit() {
    this.initTree();
    document.addEventListener('click', this.hideRMenu.bind(this), false);

    this.treeFilterSubscription = this._treeFilterSvc.onFilter.subscribe(
      keyword => {
        this._logger.debug('Filter tree: ', keyword);
        this.filterAssets(keyword);
        this.filterRemoteApps(keyword);
      }
    );
  }

  ngOnDestroy(): void {
    this.treeFilterSubscription.unsubscribe();
  }

  onAssetsNodeClick(event, treeId, treeNode, clickFlag) {
    if (treeNode.isParent) {
      this.assetsTree.expandNode(treeNode);
    } else {
      this._http.getUserProfile().subscribe();
      this.connectAsset(treeNode);
    }
  }

  refreshAssetsTree() {
    this.assetsTree.destroy();
    this.initAssetsTree(true);
  }

  initAssetsTree(refresh?: boolean) {
    const setting = Object.assign({}, this.setting);
    setting['callback'] = {
      onClick: this.onAssetsNodeClick.bind(this),
      onRightClick: this.onRightClick.bind(this)
    };
    if (this._navSvc.treeLoadAsync) {
      setting['async'] = {
        enable: true,
        url: '/api/perms/v1/users/nodes/children-with-assets/tree/',
        autoParam: ['id=key', 'name=n', 'level=lv'],
        type: 'get'
      };
    }

    this._http.getMyGrantedNodes(this._navSvc.treeLoadAsync, refresh).subscribe(resp => {
      const assetsTree = $.fn.zTree.init($('#assetsTree'), setting, resp);
      this.assetsTree = assetsTree;
      this.rootNodeAddDom(assetsTree, () => {
        this.refreshAssetsTree();
      });
    });
  }

  refreshRemoteAppsTree() {
    this.remoteAppsTree.destroy();
    this.initRemoteAppsTree();
  }
  
  onRemoteAppsNodeClick(event, treeId, treeNode, clickFlag) {
    if (treeNode.isParent) {
      this.remoteAppsTree.expandNode(treeNode);
    } else {
      this._http.getUserProfile().subscribe();
      this.connectAsset(treeNode);
    }
  }

  initRemoteAppsTree() {
    const setting = Object.assign({}, this.setting);
    setting['callback'] = {
      onClick: this.onRemoteAppsNodeClick.bind(this),
    };
    this._http.getMyGrantedRemoteApps().subscribe(
      resp => {
        const tree = $.fn.zTree.init($('#remoteAppsTree'), setting, resp);
        this.remoteAppsTree = tree;
        this.rootNodeAddDom(tree, () => {
          this.refreshRemoteAppsTree();
        });
      }
    );
  }

  initTree() {
    this.initAssetsTree();
    this.initRemoteAppsTree();
  }

  connectAsset(node: TreeNode) {
    const evt = new ConnectEvt(node, 'asset');
    connectEvt.next(evt);
  }
  
  rootNodeAddDom(ztree, callback) {
    const tId = ztree.setting.treeId + '_tree_refresh';
    const refreshIcon = '<a id=' + tId + ' class="tree-refresh">' +
      '<i class="fa fa-refresh" style="font-family: FontAwesome !important;" ></i></a>';
    const rootNode = ztree.getNodes()[0];
    const $rootNodeRef = $('#' + rootNode.tId + '_a');
    $rootNodeRef.after(refreshIcon);
    const refreshIconRef = $('#' + tId);
    refreshIconRef.bind('click', function () {
      callback();
    });
  }

  showRMenu(left, top) {
    const clientHeight = document.body.clientHeight;
    if (top + 60 > clientHeight) {
      top -= 60;
    }
    this.pos.left = left + 'px';
    this.pos.top = top + 'px';
    this.isShowRMenu = true;
  }

  hideRMenu() {
    this.isShowRMenu = false;
  }

  onRightClick(event, treeId, treeNode) {
    if (!treeNode || treeNode.isParent) {
      return null;
    }
    const host = treeNode.meta.asset;
    let findSSHProtocol = false;
    const protocols = host.protocols || [];
    if (host.protocol) {
      protocols.push(host.protocol);
    }
    for (let i = 0; i < protocols.length; i++) {
      const protocol = protocols[i];
      if (protocol && protocol.startsWith('ssh')) {
        findSSHProtocol = true;
      }
    }
    if (!findSSHProtocol) {
      alert('Windows 请使用Ctrl+Shift+Alt呼出侧边栏上传下载');
    }

    if (!treeNode && event.target.tagName.toLowerCase() !== 'button' && $(event.target).parents('a').length === 0) {
      this.assetsTree.cancelSelectedNode();
      this.showRMenu(event.clientX, event.clientY);
    } else if (treeNode && !treeNode.noR) {
      this.assetsTree.selectNode(treeNode);
      this.showRMenu(event.clientX, event.clientY);
      this.rightClickSelectNode = treeNode;
    }
  }

  connectFileManager() {
    const node = this.rightClickSelectNode;
    const evt = new ConnectEvt(node, 'sftp');
    connectEvt.next(evt);
  }

  connectTerminal() {
    const host = this.rightClickSelectNode;
    this.connectAsset(host);
  }

  filterAssets(keyword) {
    if (this._navSvc.treeLoadAsync) {
      this._logger.debug('Filter assets server');
      this.filterAssetsServer(keyword);
    } else {
      this._logger.debug('Filter assets local');
      this.filterAssetsLocal(keyword);
    }
  }

  filterTree(keyword, tree, filterCallback) {
    const nodes = tree.transformToArray(tree.getNodes());
    if (!keyword) {
      if (tree.hiddenNodes) {
        tree.showNodes(tree.hiddenNodes);
        tree.hiddenNodes = null;
      }
      if (tree.expandNodes) {
        tree.expandNodes.forEach((node) => {
          if (node.id !== nodes[0].id) {
            tree.expandNode(node, false);
          }
        });
        tree.expandNodes = null;
      }
      return null;
    }
    let shouldShow = [];
    const matchedNodes = tree.getNodesByFilter(filterCallback);
    matchedNodes.forEach((node) => {
      const parents = this.recurseParent(node);
      const children = this.recurseChildren(node);
      shouldShow = [...shouldShow, ...parents, ...children, node];
    });
    tree.hiddenNodes = nodes;
    tree.expandNodes = shouldShow;
    tree.hideNodes(nodes);
    tree.showNodes(shouldShow);
    shouldShow.forEach((node) => {
      if (node.isParent) {
        tree.expandNode(node, true);
      }
    });
  }

  filterRemoteApps(keyword) {
    if (!this.remoteAppsTree) {
      return null;
    }
    function filterCallback(node: TreeNode) {
      return node.name.toLowerCase().indexOf(keyword) !== -1;
    }
    return this.filterTree(keyword, this.remoteAppsTree, filterCallback);
  }

  filterAssetsServer(keyword) {
    if (!this.assetsTree) {
      return;
    }
    const searchNode = this.assetsTree.getNodesByFilter((node) => node.id === 'search');
    if (searchNode) {
      this.assetsTree.removeChildNodes(searchNode[0]);
      this.assetsTree.removeNode(searchNode[0]);
    }
    if (!keyword) {
      const treeNodes = this.assetsTree.getNodes();
      if (treeNodes.length !== 0) {
        this.assetsTree.showNode(treeNodes[0]);
      }
      return;
    }
    this._http.getMyGrantedAssets(keyword).subscribe(nodes => {
      const treeNodes = this.assetsTree.getNodes();
      if (treeNodes.length !== 0) {
        this.assetsTree.hideNode(treeNodes[0]);
      }
      const newNode = {id: 'search', name: translate('Search'), isParent: true, open: true, zAsync: true};
      const parentNode = this.assetsTree.addNodes(null, newNode)[0];
      parentNode.zAsync = true;
      this.assetsTree.addNodes(parentNode, nodes);
      parentNode.open = true;
    });
    return;
  }

  filterAssetsLocal(keyword) {
    if (!this.assetsTree) {
      return null;
    }
    function filterAssetsCallback(node) {
      if (node.isParent) {
        return false;
      }
      const host = node.meta.asset;
      return host.hostname.toLowerCase().indexOf(keyword) !== -1 || host.ip.indexOf(keyword) !== -1;
    }
    return this.filterTree(keyword, this.assetsTree, filterAssetsCallback);
    // zTreeObj.expandAll(true);
  }

  recurseParent(node) {
    const parentNode = node.getParentNode();
    if (parentNode && parentNode.pId) {
      return [parentNode, ...this.recurseParent(parentNode)];
    } else if (parentNode) {
      return [parentNode];
    } else {
      return [];
    }
  }

  recurseChildren(node) {
    if (!node.isParent) {
      return [];
    }
    const children = node.children;
    if (!children) {
      return [];
    }
    let allChildren = [];
    children.forEach((n) => {
      allChildren = [...children, ...this.recurseChildren(n)];
    });
    return allChildren;
  }
}

