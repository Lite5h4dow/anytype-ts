import * as React from 'react';
import $ from 'jquery';
import raf from 'raf';
import arrayMove from 'array-move';
import { observer } from 'mobx-react';
import { set } from 'mobx';
import { throttle } from 'lodash';
import { I, C, Util, DataUtil, ObjectUtil, analytics, Dataview, keyboard, Onboarding, Relation, Renderer, focus } from 'Lib';
import { blockStore, menuStore, dbStore, detailStore, popupStore, commonStore } from 'Store';
import Constant from 'json/constant.json';

import Head from './dataview/head';
import Controls from './dataview/controls';
import Selection from './dataview/selection';

import ViewGrid from './dataview/view/grid';
import ViewBoard from './dataview/view/board';
import ViewGallery from './dataview/view/gallery';
import ViewList from './dataview/view/list';
import Empty from './dataview/empty';

interface Props extends I.BlockComponent {
	isInline?: boolean;
};

interface State {
	loading: boolean;
};

const BlockDataview = observer(class BlockDataview extends React.Component<Props, State> {

	state = {
		loading: false,
	};
	node = null;
	refView = null;
	refHead = null;
	refControls = null;
	refSelect = null;
	refCells: Map<string, any> = new Map();

	menuContext: any = null;
	viewId = '';
	creating = false;
	frame = 0;
	isMultiSelecting = false;
	selected: string[] = [];

	constructor (props: Props) {
		super(props);
		
		this.loadData = this.loadData.bind(this);
		this.getRecords = this.getRecords.bind(this);
		this.getRecord = this.getRecord.bind(this);
		this.getView = this.getView.bind(this);
		this.getSources = this.getSources.bind(this);
		this.getKeys = this.getKeys.bind(this);
		this.getIdPrefix = this.getIdPrefix.bind(this);
		this.getVisibleRelations = this.getVisibleRelations.bind(this);
		this.getEmpty = this.getEmpty.bind(this);
		this.getTarget = this.getTarget.bind(this);
		this.onRecordAdd = this.onRecordAdd.bind(this);
		this.onCellClick = this.onCellClick.bind(this);
		this.onCellChange = this.onCellChange.bind(this);
		this.onContext = this.onContext.bind(this);
		this.onKeyDown = this.onKeyDown.bind(this);
		this.onKeyUp = this.onKeyUp.bind(this);
		this.onFocus = this.onFocus.bind(this);
		this.onSourceSelect = this.onSourceSelect.bind(this);
		this.onSourceTypeSelect = this.onSourceTypeSelect.bind(this);
		this.onEmpty = this.onEmpty.bind(this);
		this.onDragRecordStart = this.onDragRecordStart.bind(this);
		this.onRecordDrop = this.onRecordDrop.bind(this);
		this.isAllowedObject = this.isAllowedObject.bind(this);
		this.isCollection = this.isCollection.bind(this);
		this.objectOrderUpdate = this.objectOrderUpdate.bind(this);
		this.applyObjectOrder = this.applyObjectOrder.bind(this);
		this.setMultiSelect = this.setMultiSelect.bind(this);
		this.onMultiSelect = this.onMultiSelect.bind(this);
		this.multiSelectAction = this.multiSelectAction.bind(this);
	};

	render () {
		const { rootId, block, isPopup, isInline } = this.props;
		const { loading } = this.state;
		const views = dbStore.getViews(rootId, block.id);

		if (!views.length) {
			return null;
		};

		const view = this.getView();
		if (!view) {
			return null;
		};

		const sources = this.getSources();
		const targetId = this.getObjectId();
		const isCollection = this.isCollection();
		const cn = [ 'focusable', 'c' + block.id ];

		let { groupRelationKey, pageLimit } = view;
		let ViewComponent: any = null;
		let className = [ Util.toCamelCase('view-' + I.ViewType[view.type]) ];
		let head = null;
		let body = null;

		if (isCollection) {
			className.push('isCollection');
		};

		switch (view.type) {
			default:
			case I.ViewType.Grid:
				ViewComponent = ViewGrid;
				break;
				
			case I.ViewType.Board:
				ViewComponent = ViewBoard;
				break;
				
			case I.ViewType.Gallery:
				ViewComponent = ViewGallery;
				break;
			
			case I.ViewType.List:
				ViewComponent = ViewList;
				break;
		};

		const dataviewProps = {
			readonly: false,
			loadData: this.loadData,
			getView: this.getView,
			getTarget: this.getTarget,
			getObjectId: this.getObjectId(),
			getSources: this.getSources,
			getRecord: this.getRecord,
			getRecords: this.getRecords,
			getKeys: this.getKeys,
			getIdPrefix: this.getIdPrefix,
			getLimit: () => this.getLimit(view.type),
			getVisibleRelations: this.getVisibleRelations,
			getEmpty: this.getEmpty,
			onRecordAdd: this.onRecordAdd,
			isAllowedObject: this.isAllowedObject,
			isCollection,
			isInline,
			className: className.join(' '),
		};

		const controls = (
			<React.Fragment>
				<Controls 
					ref={ref => this.refControls = ref} 
					{...this.props} 
					{...dataviewProps} 
				/>
				<Selection 
					ref={ref => this.refSelect = ref} 
					{...this.props} 
					{...dataviewProps} 
					multiSelectAction={this.multiSelectAction} 
				/>
			</React.Fragment>
		);

		if (isInline) {
			head = (
				<Head 
					ref={(ref: any) => { this.refHead = ref; }} 
					{...this.props}
					{...dataviewProps}
					onSourceSelect={this.onSourceSelect}
					onSourceTypeSelect={this.onSourceTypeSelect}
				/>
			);
		};

		if (loading) {
			body = null;
		} else
		if (isInline && !targetId) {
			body = this.getEmpty('target');
		} else
		if (!isCollection && !sources.length) {
			body = this.getEmpty('source');
		} else {
			body = (
				<div className="content">
					<ViewComponent 
						key={'view' + view.id}
						ref={ref => this.refView = ref} 
						onRef={(ref: any, id: string) => { this.refCells.set(id, ref); }} 
						{...this.props}
						{...dataviewProps}
						bodyContainer={Util.getBodyContainer(isPopup ? 'popup' : 'page')}
						pageContainer={Util.getCellContainer(isPopup ? 'popup' : 'page')}
						onCellClick={this.onCellClick}
						onCellChange={this.onCellChange}
						onContext={this.onContext}
						objectOrderUpdate={this.objectOrderUpdate}
						applyObjectOrder={this.applyObjectOrder}
						onDragRecordStart={this.onDragRecordStart}
						onMultiSelect={this.onMultiSelect}
					/>
				</div>
			);
		};

		return (
			<div 
				ref={node => this.node = node}
				tabIndex={0} 
				className={cn.join(' ')}
				onKeyDown={this.onKeyDown} 
				onKeyUp={this.onKeyUp} 
				onFocus={this.onFocus}
			>
				<div className="hoverArea">
					{head}
					{controls}
				</div>
				{body}
			</div>
		);
	};

	componentDidMount () {
		const { rootId, block, isPopup, isInline } = this.props;
		const view = this.getView();
		const root = blockStore.getLeaf(rootId, rootId);

		if (view) {
			dbStore.metaSet(rootId, block.id, { viewId: view.id, offset: 0, total: 0 });
			this.loadData(view.id, 0, true);
		};

		if (root.isObjectSet()) {
			Onboarding.start('set', isPopup);
		};

		this.init();
		this.resize();
		this.rebind();

		const eventName = this.isCollection() ? 'ScreenCollection' : 'ScreenSet';
		analytics.event(eventName, { embedType: analytics.embedType(isInline) });
	};

	componentDidUpdate () {
		const { rootId, block } = this.props;
		const { viewId } = dbStore.getMeta(dbStore.getSubId(rootId, block.id), '');

		if (viewId && (viewId != this.viewId)) {
			this.loadData(viewId, 0, true);
		};

		this.init();
		this.resize();
		this.rebind();
	};

	componentWillUnmount () {
		this.unbind();
	};

	init () {
		const { block } = this.props;
		const node = $(this.node);
		const head = node.find(`#block-head-${block.id}`);
		const object = this.getTarget();

		object.isDeleted ? head.addClass('isDeleted') : head.removeClass('isDeleted');
	};

	unbind () {
		const { block } = this.props;
		const events = [ 'resize', 'updateDataviewData', 'setDataviewSource', 'selectionEnd', 'selectionClear' ];

		$(window).off(events.map(it => `${it}.${block.id}`).join(' '));
	};

	rebind () {
		const { block } = this.props;
		const win = $(window);

		this.unbind();

		win.on(`resize.${block.id}`, throttle(() => this.resize(), 20));
		win.on(`updateDataviewData.${block.id}`, () => this.loadData(this.getView().id, 0, true));
		win.on(`setDataviewSource.${block.id}`, () => this.onSourceSelect(`#block-${block.id} #head-title-wrapper #value`, {}));
		win.on(`selectionEnd.${block.id}`, () => this.onMultiSelect());
		win.on(`selectionClear.${block.id}`, () => {
			if (this.isMultiSelecting) {
				this.setMultiSelect(false);
			};
		});
	};

	onKeyDown (e: any) {
		const { onKeyDown } = this.props;

		if (onKeyDown) {
			onKeyDown(e, '', [], { from: 0, to: 0 }, this.props);
		};
	};

	onKeyUp (e: any) {
		const { onKeyUp } = this.props;

		if (onKeyUp) {
			onKeyUp(e, '', [], { from: 0, to: 0 }, this.props);
		};
	};

	onFocus () {
		const { block } = this.props;
		focus.set(block.id, { from: 0, to: 0 });
	};

	loadData (viewId: string, offset: number, clear: boolean, callBack?: (message: any) => void) {
		if (!viewId) {
			console.log('[BlockDataview.loadData] No view id');
			return;
		};

		const view = this.getView(viewId);
		if (!view) {
			console.log('[BlockDataview.loadData] No view');
			return;
		};

		this.viewId = viewId;

		const { rootId, block } = this.props;
		const subId = dbStore.getSubId(rootId, block.id);
		const keys = this.getKeys(viewId);
		const sources = this.getSources();
		const isCollection = this.isCollection();

		if (!sources.length && !isCollection) {
			console.log('[BlockDataview.loadData] No sources');
			return;
		}

		if (clear) {
			dbStore.recordsSet(subId, '', []);
		};

		dbStore.metaSet(subId, '', { offset, viewId });

		if ([ I.ViewType.Board ].includes(view.type)) {
			if (this.refView && this.refView.loadGroupList) {
				this.refView.loadGroupList();
			} else {
				this.viewId = '';
			};
		} else {
			if (clear) {
				this.setState({ loading: true });
			};

			Dataview.getData({
				rootId, 
				blockId: block.id, 
				newViewId: viewId, 
				keys, 
				offset: 0, 
				limit: offset + this.getLimit(view.type), 
				clear,
				sources,
				collectionId: (isCollection ? this.getObjectId() : ''),
			}, (message: any) => {
				if (clear) {
					this.setState({ loading: false });
				};

				if (callBack) {
					callBack(message);
				};
			});
		};
	};

	getObjectId () {
		const { rootId, block, isInline } = this.props;
		return isInline ? block.content.targetObjectId : rootId;
	};

	getKeys (id: string): string[] {
		let view = this.getView(id);
		let keys = Constant.defaultRelationKeys.concat(Constant.coverRelationKeys);

		if (view) {
			keys = keys.concat((view.relations || []).map(it => it.relationKey));

			if (view.coverRelationKey) {
				keys.push(view.coverRelationKey);
			};

			if (view.groupRelationKey) {
				keys.push(view.groupRelationKey);
			};
		};

		return Util.arrayUnique(keys);
	};

	getLimit (type: I.ViewType): number {
		const { isInline } = this.props;
		const view = this.getView();
		const options = Relation.getPageLimitOptions(view.type);
		const pageLimit = Number(view.pageLimit) || options[0].id;

		let limit = 0;

		switch (type) {
			default:
				limit = isInline ? pageLimit : 0;
				break;

			case I.ViewType.Board:
				limit = pageLimit || 50;
				break;
			
		};
		return limit;
	};

	getRecords (): string[] {
		const { rootId, block } = this.props;
		const subId = dbStore.getSubId(rootId, block.id);
		const records = dbStore.getRecords(subId, '');

		return this.applyObjectOrder(Util.objectCopy(records));
	};

	getRecord (recordId: string) {
		const { rootId, block } = this.props;
		const view = this.getView();
		const keys = this.getKeys(view.id);
		const subId = dbStore.getSubId(rootId, block.id);
		const item = detailStore.get(subId, recordId, keys);

		if (!item) {
			return {};
		};

		let { name, layout, isReadonly, isDeleted, snippet } = item;
		if (name == ObjectUtil.defaultName('page')) {
			name = '';
		};
		if (layout == I.ObjectLayout.Note) {
			name = snippet;
		};

		item.name = name;
		item.isReadonly = isDeleted || isReadonly;

		return item;
	};

	getView (viewId?: string): I.View {
		const { rootId, block } = this.props;
		return Dataview.getView(rootId, block.id, viewId);
	};

	getSources (): string[] {
		if (this.isCollection()) {
			return [];
		};

		const { rootId } = this.props;
		const target = this.getTarget();
		const types = Relation.getSetOfObjects(rootId, target.id, Constant.typeId.type).map(it => it.id);
		const relations = Relation.getSetOfObjects(rootId, target.id, Constant.typeId.relation).map(it => it.id);

		return [].concat(types).concat(relations);
	};

	getTarget () {
		const { rootId, block, isInline } = this.props;
		const { targetObjectId } = block.content;

		return detailStore.get(rootId, isInline ? targetObjectId : rootId, [ 'setOf' ]);
	};

	onEmpty (e: any) {
		const { isInline } = this.props;

		if (isInline) {
			this.onSourceSelect(e.currentTarget, { horizontal: I.MenuDirection.Center });
		} else {
			this.onSourceTypeSelect(e.currentTarget);
		};
	};

	onRecordAdd (e: any, dir: number, withPopup?: boolean) {
		if (e.persist) {
			e.persist();
		};

		if (this.creating) {
			return;
		};

		const { rootId, block } = this.props;
		const objectId = this.getObjectId();
		const object = detailStore.get(rootId, objectId, [ 'setOf' ], true);
		const setOf = object.setOf || [];
		const element = $(e.currentTarget);
		const view = this.getView();
		const subId = dbStore.getSubId(rootId, block.id);
		const isCollection = this.isCollection();
		const conditions = [
			I.FilterCondition.Equal,
			I.FilterCondition.In,
			I.FilterCondition.AllIn,
		]; 

		const types = Relation.getSetOfObjects(rootId, objectId, Constant.typeId.type);
		const relations = Relation.getSetOfObjects(rootId, objectId, Constant.typeId.relation);
		const details: any = {
			type: types.length ? types[0].id : commonStore.type,
		};
		const flags: I.ObjectFlag[] = [];

		if (!types.length || isCollection) {
			flags.push(I.ObjectFlag.SelectType);
		};

		if (relations.length) {
			relations.forEach((it: any) => {
				details[it.relationKey] = Relation.formatValue(it, null, true);
			});
		};

		for (let filter of view.filters) {
			if (!conditions.includes(filter.condition) || !filter.value) {
				continue;
			};
			
			const relation = dbStore.getRelationByKey(filter.relationKey);
			if (relation && !relation.isReadonlyValue) {
				details[filter.relationKey] = Relation.formatValue(relation, filter.value, true);
			};
		};

		this.creating = true;

		const create = (template: any) => {
			C.ObjectCreate(details, flags, template?.id, (message: any) => {
				this.creating = false;

				if (message.error.code) {
					return;
				};

				const object = message.details;
				const records = this.getRecords();
				const oldIndex = records.indexOf(message.objectId);
				const newIndex = dir > 0 ? records.length - 1 : 0;

				if (isCollection) {
					C.ObjectCollectionAdd(objectId, [ object.id ]);
				};

				if (oldIndex < 0) {
					dbStore.recordAdd(subId, '', object.id, newIndex);
				} else {
					dbStore.recordsSet(subId, '', arrayMove(records, oldIndex, newIndex));
				};

				const id = Relation.cellId(this.getIdPrefix(), 'name', object.id);
				const ref = this.refCells.get(id);

				if (ref && view.isGrid() && (object.type != Constant.typeId.note)) {
					window.setTimeout(() => { ref.onClick(e); }, 15);
				};

				analytics.event('CreateObject', {
					route: 'Set',
					objectType: object.type,
					layout: object.layout,
					template: template ? (template.templateIsBundled ? template.id : 'custom') : '',
				});
			});
		};

		if (details.type == Constant.typeId.bookmark) {
			menuStore.open('dataviewCreateBookmark', {
				type: I.MenuType.Horizontal,
				element,
				vertical: dir > 0 ? I.MenuDirection.Top : I.MenuDirection.Bottom,
				horizontal: dir > 0 ? I.MenuDirection.Left : I.MenuDirection.Right,
				data: {
					details,
				},
			});
			return;
		};

		const showPopup = () => {
			popupStore.open('template', { data: { typeId: details.type, onSelect: create } });
		};

		const showMenu = () => {
			menuStore.open('searchObject', {
				element: element,
				className: 'single',
				subIds: [ 'previewObject' ],
				vertical: dir > 0 ? I.MenuDirection.Top : I.MenuDirection.Bottom,
				horizontal: dir > 0 ? I.MenuDirection.Left : I.MenuDirection.Right,
				data: {
					label: 'Choose a template',
					noFilter: true,
					noIcon: true,
					filters: [
						{ operator: I.FilterOperator.And, relationKey: 'type', condition: I.FilterCondition.Equal, value: Constant.typeId.template },
						{ operator: I.FilterOperator.And, relationKey: 'targetObjectType', condition: I.FilterCondition.In, value: setOf },
					],
					sorts: [
						{ relationKey: 'name', type: I.SortType.Asc },
					],
					onOver: (e: any, context: any, item: any) => {
						menuStore.open('previewObject', {
							element: `#${context.props.getId()} #item-${item.id}`,
							offsetX: context.props.getSize().width,
							isSub: true,
							vertical: I.MenuDirection.Center,
							data: { rootId: item.id }
						});
					},
					onSelect: (item: any) => {
						create(item);

						window.setTimeout(() => { menuStore.close('previewObject'); }, Constant.delay.menu);
					},
				}
			});
		};

		DataUtil.checkTemplateCnt(setOf, (message: any) => {
			if (message.records.length > 1) {
				withPopup ? showPopup() : showMenu();
			} else {
				create(message.records.length ? message.records[0] : '');
			};
		});
	};

	onCellClick (e: any, relationKey: string, recordId: string) {
		if (e.button) {
			return;
		};

		const { dataset } = this.props;
		const { selection } = dataset || {};
		const relation = dbStore.getRelationByKey(relationKey);
		const id = Relation.cellId(this.getIdPrefix(), relationKey, recordId);
		const ref = this.refCells.get(id);
		const record = this.getRecord(recordId);
		const view = this.getView();

		if (!relation || !ref || !record) {
			return;
		};

		if ([ I.ViewType.List, I.ViewType.Gallery, I.ViewType.Board ].includes(view.type) && Relation.isUrl(relation.format)) {
			Renderer.send('urlOpen', Relation.getUrlScheme(relation.format, record[relationKey]) + record[relationKey]);
			return;
		};

		if ((relationKey == 'name') && (!ref.ref.state.isEditing)) {
			const ids = selection ? selection.get(I.SelectType.Record) : [];
			if (keyboard.withCommand(e)) {
				if (ids.length) {
					return;
				} else {
					ObjectUtil.openWindow(record);
				};
			} else {
				ObjectUtil.openPopup(record);
			};
		} else {
			ref.onClick(e);
		};
	};

	onCellChange (id: string, relationKey: string, value: any, callBack?: (message: any) => void) {
		const { rootId, block } = this.props;
		const subId = dbStore.getSubId(rootId, block.id);
		const relation = dbStore.getRelationByKey(relationKey);

		if (!relation) {
			return;
		};

		value = Relation.formatValue(relation, value, true);

		/*
		let details: any = {};
		details[relationKey] = value;
		detailStore.update(subId, { id, details }, false);
		*/

		C.ObjectSetDetails(id, [ { key: relationKey, value } ], callBack);

		const key = Relation.checkRelationValue(relation, value) ? 'ChangeRelationValue' : 'DeleteRelationValue';		
		analytics.event(key, { type: 'dataview' });
	};

	onContext (e: any, id: string): void {
		e.preventDefault();
		e.stopPropagation();

		const { rootId, block, dataset } = this.props;
		const { selection } = dataset || {};
		const subId = dbStore.getSubId(rootId, block.id);
		const isCollection = this.isCollection();
		
		let ids = selection.get(I.SelectType.Record);
		if (!ids.length) {
			ids = [ id ];
		};

		menuStore.open('dataviewContext', {
			recalcRect: () => { 
				const { x, y } = keyboard.mouse.page;
				return { width: 0, height: 0, x: x + 4, y: y };
			},
			onClose: () => { selection.clear(); },
			data: {
				targetId: this.getObjectId(),
				objectIds: ids,
				subId,
				isCollection,
			}
		});
	};

	onSourceSelect (element: any, param: Partial<I.MenuParam>) {
		const { rootId, block, isPopup, isInline } = this.props;
		const { targetObjectId } = block.content;
		const isCollection = this.isCollection();

		let filters: I.Filter[] = [];
		let addParam: any = {};

		if (isCollection) {
			addParam.name = 'Create new collection';
			addParam.onClick = () => {
				C.ObjectCreate({ layout: I.ObjectLayout.Collection, type: Constant.typeId.collection }, [], '', (message: any) => { 
					onSelect(message.details, true); 
				});
			};

			filters = filters.concat([
				{ operator: I.FilterOperator.And, relationKey: 'type', condition: I.FilterCondition.Equal, value: Constant.typeId.collection },
			]);
		} else {
			addParam.name = 'Create new set';
			addParam.onClick = () => {
				C.ObjectCreateSet([], {}, '', (message: any) => { onSelect(message.details, true); });
			};

			filters = filters.concat([
				{ operator: I.FilterOperator.And, relationKey: 'type', condition: I.FilterCondition.Equal, value: Constant.typeId.set },
				{ operator: I.FilterOperator.And, relationKey: 'setOf', condition: I.FilterCondition.NotEmpty, value: null },
			]);
		};

		const onSelect = (item: any, isNew: boolean) => {
			C.BlockDataviewCreateFromExistingObject(rootId, block.id, item.id, (message: any) => {
				const button = $(this.node).find('#head-source-select');

				if (!isCollection && isNew && button.length) {
					button.trigger('click');
				};

				if (message.views && message.views.length) {
					window.setTimeout(() => { this.loadData(message.views[0].id, 0, true); }, 50);
				};

				if (isInline) {
					Onboarding.start('inlineSet', isPopup, false, {
						parseParam: (param: any) => {
							param.element = [ `#block-${block.id}`, param.element ].join(' ');
							return param;
						},
					});
				};
			});

			analytics.event('InlineSetSetSource', { type: isNew ? 'newObject': 'externalObject' });
		};

		const menuParam = Object.assign({
			element: $(element),
			className: 'single',
			data: {
				rootId,
				blockId: block.id,
				blockIds: [ block.id ],
				value: [ targetObjectId ],
				canAdd: true,
				filters,
				addParam,
				onSelect,
			}
		}, param || {});

		menuStore.open('searchObject', menuParam);
	};

	onSourceTypeSelect (obj: any) {
		const { rootId, block } = this.props;
		const objectId = this.getObjectId();
		const element = $(obj);

		menuStore.closeAll(null, () => {
			menuStore.open('dataviewSource', {
				element,
				horizontal: I.MenuDirection.Center,
				onOpen: () => { 
					element.addClass('active');
				}, 
				onClose: () => {
					element.removeClass('active');
				}, 
				data: {
					rootId,
					objectId,
					blockId: block.id,
				}
			});
		});
	};

	onDragRecordStart (e: any, recordId: string) {
		e.stopPropagation();

		const { dataset, block } = this.props;
		const { selection, onDragStart } = dataset || {};
		const record = this.getRecord(recordId);

		let ids = selection.get(I.SelectType.Record);
		if (!ids.length) {
			ids = [ record.id ];
		};

		keyboard.setSelectionClearDisabled(false);

		if (!selection || !onDragStart) {
			return;
		};

		if (!block.isDraggable()) {
			e.preventDefault();
			return;
		};

		keyboard.disableSelection(true);

		onDragStart(e, I.DropType.Record, ids, this);
	};

	onRecordDrop (targetId: string, ids: string[]) {
		const { rootId, block, dataset } = this.props;
		const { selection } = dataset || {};
		const subId = dbStore.getSubId(rootId, block.id);
		const view = this.getView();

		if (!ids.length) {
			return;
		};

		if (selection) {
			selection.clear();
			this.setMultiSelect(false);
		};

		let records = this.getRecords();
		if (records.indexOf(targetId) > records.indexOf(ids[0])) {
			ids = ids.reverse();
		};

		ids.forEach(id => {
			const oldIndex = records.indexOf(id);
			const targetIndex = records.indexOf(targetId);

			records = arrayMove(records, oldIndex, targetIndex);
		});

		dbStore.recordsSet(subId, '', records);
		this.objectOrderUpdate([ { viewId: view.id, groupId: '', objectIds: records } ], records);
	};

	getIdPrefix () {
		return [ 'dataviewCell', this.props.block.id ].join('-');
	};

	getVisibleRelations () {
		const { rootId, block } = this.props;
		const view = this.getView();
		const keys = dbStore.getObjectRelationsKeys(rootId, block.id);

		return view.getVisibleRelations().filter(it => keys.includes(it.relationKey));
	};

	getEmpty (type: string) {
		const { isInline, block } = this.props;
		const cn = [];

		if (isInline) {
			cn.push('withHead');
		};

		let emptyProps: any = {};

		switch (type) {
			case 'target': {
				emptyProps = {
					title: 'No data source',
					description: 'Connect one of your sets or create new<br/>one to continue',
					button: 'Select source',
					onClick: () => this.onSourceSelect(`#block-${block.id} .dataviewEmpty .button`, {}),
				};
				break;
			};

			case 'source': {
				emptyProps = {
					title: 'No query selected',
					description: 'Add search query to aggregate objects with equal<br/>types and relations in a live mode',
					button: 'Select query',
					onClick: this.onEmpty,
				};
				break;
			};

			case 'view': {
				cn.push('withHead');

				emptyProps.title = 'No objects';

				if (this.isAllowedObject()) {
					emptyProps.description = 'Create your first one to begin';
					emptyProps.button = 'Create object';
					emptyProps.onClick = e => this.onRecordAdd(e, 1);
				};
				break;
			};
		};

		return (
			<Empty
				{...this.props}
				{...emptyProps}
				className={cn.join(' ')}
				withButton={emptyProps.button ? true : false}
			/>
		);
	};

	isAllowedObject () {
		const { rootId, block, readonly } = this.props;
		const targetId = this.getObjectId();
		const types = Relation.getSetOfObjects(rootId, targetId, Constant.typeId.type).map(it => it.id);
		const skipTypes = ObjectUtil.getFileTypes().concat(ObjectUtil.getSystemTypes());

		let allowed = !readonly && blockStore.checkFlags(rootId, block.id, [ I.RestrictionDataview.Object ]);
		for (const type of types) {
			if (skipTypes.includes(type)) {
				allowed = false;
				break;
			};
		};
		return allowed;
	};

	isCollection (): boolean {
		const { rootId, block } = this.props;
		return Dataview.isCollection(rootId, block.id);
	};

	objectOrderUpdate (orders: any[], records: any[], callBack?: (message0: any) => void) {
		const { rootId, block } = this.props;
		const view = this.getView();

		C.BlockDataviewObjectOrderUpdate(rootId, block.id, orders, (message) => {
			if (message.error.code) {
				return;
			};

			orders.forEach((it: any) => {
				let old = block.content.objectOrder.find(item => (view.id == item.viewId) && (item.groupId == it.groupId));
				if (old) {
					set(old, it);
				} else {
					block.content.objectOrder.push(it);
				};

				window.setTimeout(() => { this.applyObjectOrder(records, it.groupId); }, 30);
			});

			if (callBack) {
				callBack(message);
			};
		});
	};

	applyObjectOrder (records: any[], groupId?: string): string[] {
		const { block } = this.props;
		const view = this.getView();
		const el = block.content.objectOrder.find(it => (it.viewId == view.id) && (groupId ? it.groupId == groupId : true));
		const objectIds = el ? el.objectIds || [] : [];

		records.sort((c1: any, c2: any) => {
			const idx1 = objectIds.indexOf(c1);
			const idx2 = objectIds.indexOf(c2);

			if (idx1 > idx2) return 1;
			if (idx1 < idx2) return -1;
			return 0;
		});

		return records;
	};

	onMultiSelect (id?: string) {
		const { dataset, isInline } = this.props;
		const { selection } = dataset || {};

		if (!selection || isInline) {
			return;
		};

		let ids = [];
		if (this.isMultiSelecting && id && !ids.length) {
			ids = this.selected || [];
		} else {
			ids = selection.get(I.SelectType.Record);
		};

		if (id) {
			ids = ids.includes(id) ? ids.filter(it => it != id) : ids.concat([ id ]);
			selection.set(I.SelectType.Record, ids);
		};

		this.setMultiSelect(!!ids.length);
		this.setSelected(ids);

		window.setTimeout(() => menuStore.closeAll(), Constant.delay.menu);
	};

	setMultiSelect (v: boolean) {
		if (v == this.isMultiSelecting) {
			return;
		};

		if (!v) {
			this.selected = [];
		};

		this.setSelected(this.selected);
		this.isMultiSelecting = v;

		const node = $(this.node);
		const con = node.find('#dataviewControls');
		const sel = node.find('#dataviewSelection');

		v ? con.hide() : con.show();
		v ? sel.show() : sel.hide();
	};

	setSelected (ids: string[]) {
		this.selected = ids;

		if (this.refSelect) {
			this.refSelect.setIds(ids);
		};
	};

	multiSelectAction (id: string) {
		const objectId = this.getObjectId();
		const count = this.selected.length;

		switch (id) {
			case 'archive': {
				C.ObjectListSetIsArchived(this.selected, true, () => {
					analytics.event('MoveToBin', { count });
				});
				break;
			};

			case 'unlink': {
				C.ObjectCollectionRemove(objectId, this.selected, () => {
					analytics.event('UnlinkFromCollection', { count });
				});
				break;
			};
		};

		this.setMultiSelect(false);
	};

	resize () {
		if (this.frame) {
			raf.cancel(this.frame);
		};

		this.frame = raf(() => {
			if (this.refControls && this.refControls.resize) {
				this.refControls.resize();
			};

			if (this.refView && this.refView.resize) {
				this.refView.resize();
			};
		});
	};

});

export default BlockDataview;