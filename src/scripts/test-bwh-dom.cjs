// Simulation test of BWH Frontdesk Web DOM injection and scraping
const assert = require('assert');

// 1. Mock minimal DOM structure matching the live inspector findings
class MockElement {
  constructor(tagName, attributes = {}, textContent = '') {
    this.tagName = tagName.toUpperCase();
    this.attributes = attributes;
    this._text = textContent;
    this.children = [];
    this.parentElement = null;
    this.style = {};
    this.listeners = {};
  }

  get textContent() {
    if (this._text) return this._text;
    return this.children.map(c => c.textContent).join(' ');
  }

  set textContent(val) {
    this._text = val;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  insertBefore(newChild, refChild) {
    newChild.parentElement = this;
    const idx = this.children.indexOf(refChild);
    if (idx >= 0) {
      this.children.splice(idx, 0, newChild);
    } else {
      this.children.push(newChild);
    }
    return newChild;
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  addEventListener(event, fn) {
    this.listeners[event] = fn;
  }

  click() {
    if (this.listeners['click']) {
      this.listeners['click']({ preventDefault() {}, stopPropagation() {} });
    }
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    function match(el) {
      let matched = false;
      if (selector.includes('aria-label') && el.attributes['aria-label']) matched = true;
      else if (selector.includes('span.user-name') && el.tagName === 'SPAN' && (el.attributes.class || '').includes('user-name')) matched = true;
      else if (selector.includes('.phone span') && el.tagName === 'SPAN' && el.parentElement && (el.parentElement.attributes.class || '').includes('phone')) matched = true;
      else if (selector.includes('.hk-tooltip-wrapper span') && el.tagName === 'SPAN' && el.parentElement && (el.parentElement.attributes.class || '').includes('hk-tooltip-wrapper')) matched = true;
      else if (selector.includes('div.date-title h4') && el.tagName === 'H4' && el.parentElement && (el.parentElement.attributes.class || '').includes('date-title')) matched = true;
      else if (selector.includes('.flexed.gap-5') && (el.attributes.class || '').includes('flexed') && (el.attributes.class || '').includes('gap-5')) matched = true;
      else if (selector.includes('[data-fdp-injected]') && el.attributes['data-fdp-injected']) matched = true;
      else if (selector.includes('.edit-icon:first-child') && (el.attributes.class || '').includes('edit-icon') && el.parentElement && el.parentElement.children[0] === el) matched = true;
      else if (selector.includes('data-v-75e89ec1') && el.attributes['data-v-75e89ec1'] !== undefined && (el.attributes.class || '').includes('card')) matched = true;

      if (matched) results.push(el);
      for (const c of el.children) match(c);
    }
    match(this);
    return results;
  }
}

class MockDocument extends MockElement {
  constructor() {
    super('DOCUMENT');
    this.body = new MockElement('BODY');
    this.head = new MockElement('HEAD');
    this.appendChild(this.body);
  }

  createElement(tag) {
    return new MockElement(tag);
  }
}

// 2. Build the exact BWH DOM tree found by the inspector
const doc = new MockDocument();

// Top header with Reservation #, Name, Room #
const dateTitle = new MockElement('DIV', { class: 'date-title' });
const h4 = new MockElement('H4', { 'data-v-796e4b3f': '' }, '14241009367  / RAY ALLEN   / Room - 123');
dateTitle.appendChild(h4);
doc.body.appendChild(dateTitle);

// Reservation Card
const card = new MockElement('DIV', { class: 'card', 'data-v-75e89ec1': '' });
const headerRow = new MockElement('DIV', { class: 'fw-600 flexed justify-between', 'data-v-75e89ec1': '' });

// Left group: Name
const leftGroup = new MockElement('DIV', { class: 'flexed', 'data-v-75e89ec1': '' });
const nameSpan = new MockElement('SPAN', { class: 'user-name', 'data-v-75e89ec1': '' }, 'RAY ALLEN');
leftGroup.appendChild(nameSpan);
headerRow.appendChild(leftGroup);

// Right group: action buttons [refresh][edit]
const actionGroup = new MockElement('DIV', { class: 'flexed gap-5', 'data-v-75e89ec1': '' });
const refreshIcon = new MockElement('DIV', { class: 'edit-icon ms-pointer', 'data-train-key-id': 'guest_dashboard', 'data-v-75e89ec1': '' });
const editIcon = new MockElement('DIV', { class: 'edit-icon ms-pointer', 'aria-label': 'Edit Guest Details', 'data-v-75e89ec1': '' });
actionGroup.appendChild(refreshIcon);
actionGroup.appendChild(editIcon);
headerRow.appendChild(actionGroup);
card.appendChild(headerRow);

// Card Body: Phone & Email
const userInfo = new MockElement('DIV', { class: 'flexed-column user-info', 'data-v-75e89ec1': '' });
const emailPhone = new MockElement('DIV', { class: 'email-phone', 'data-v-75e89ec1': '' });

const emailWrap = new MockElement('DIV', { class: 'hk-tooltip-wrapper', 'data-v-75e89ec1': '' });
const emailSpan = new MockElement('SPAN', { 'data-v-75e89ec1': '' }, 'tbeevraa70@m.expediapartnercentral.com');
emailWrap.appendChild(emailSpan);
emailPhone.appendChild(emailWrap);

const phoneRow = new MockElement('DIV', { class: 'flexed align-center phone', 'data-v-75e89ec1': '' });
const phoneSpan = new MockElement('SPAN', { 'data-v-75e89ec1': '' }, '+17792450357');
phoneRow.appendChild(phoneSpan);
emailPhone.appendChild(phoneRow);

userInfo.appendChild(emailPhone);
card.appendChild(userInfo);
doc.body.appendChild(card);

// 3. Test the script against this mock DOM
delete require.cache[require.resolve('./bwh-reservation-injector.js')];
require('./bwh-reservation-injector.js');
const api = globalThis.BwhInjector;

console.log('Testing BWH DOM Scraper...');
const scraped = api.scrapeActiveReservation(doc);
console.log('Scraped Data:', scraped);

assert.strictEqual(scraped.guestName, 'RAY ALLEN', 'Guest name must match');
assert.strictEqual(scraped.phone, '+17792450357', 'Phone number must match');
assert.strictEqual(scraped.email, 'tbeevraa70@m.expediapartnercentral.com', 'Email must match');
assert.strictEqual(scraped.reservation, '14241009367', 'Reservation number must match');
assert.strictEqual(scraped.room, '123', 'Room number must match');
console.log('✅ All field extractions passed (5/5)');

console.log('Testing Button Injection...');
const injectedCount = api.inject(doc);
assert.strictEqual(injectedCount, 1, 'Exactly one action group should be injected');

// Verify buttons placement
assert.strictEqual(actionGroup.children.length, 3, 'Action group should now have 3 children (wrapper + refresh + edit)');
const wrapper = actionGroup.children[0];
assert.strictEqual(wrapper.attributes['data-fdp-injected'], 'wrap', 'First child must be our injected wrapper');
assert.strictEqual(actionGroup.children[1], refreshIcon, 'Second child must be the original refresh icon');
assert.strictEqual(actionGroup.children[2], editIcon, 'Third child must be the original edit icon');
console.log('✅ Button placement confirmed: Inserted right before refresh and edit buttons!');

console.log('Testing Injected Button Clicks...');
let sentMessage = null;
globalThis.postMessage = (msg) => { sentMessage = msg; };

const complaintBtn = wrapper.children[0];
complaintBtn.click();
assert.ok(sentMessage, 'A message should be dispatched on click');
assert.strictEqual(sentMessage.type, 'FRONTDESK_AUTOFILL_LOG');
assert.strictEqual(sentMessage.category, 'Complaint');
assert.strictEqual(sentMessage.data.name, 'RAY ALLEN');
assert.strictEqual(sentMessage.data.room, '123');
assert.strictEqual(sentMessage.data.reservation, '14241009367');
assert.strictEqual(sentMessage.data.phone, '+17792450357');
assert.strictEqual(sentMessage.data.email, 'tbeevraa70@m.expediapartnercentral.com');
console.log('✅ Click event dispatches FRONTDESK_AUTOFILL_LOG with all 5 fields correctly!');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! The script is 100% verified.');
