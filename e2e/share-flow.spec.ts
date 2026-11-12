import { type Browser, type Page, expect, test } from '@playwright/test';

// The core reviewer journey, end to end in a real browser with two separate users:
// Alice creates and formats a document, shares it read-only with Bob, Bob sees it as a
// viewer (and sees Alice's next edit arrive live), then Alice upgrades him to editor.

async function signInAs(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext(); // separate cookies = separate user
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByText(`Signed in as ${name}`)).toBeVisible();
  return page;
}

test('owner shares a document; viewer is read-only and sees live updates; upgrade to editor', async ({ browser }) => {
  const title = `E2E ${Date.now()}`;
  const alice = await signInAs(browser, 'Alice Johnson');

  // Create, rename and format.
  await alice.getByRole('button', { name: '+ New document' }).click();
  await alice.waitForURL(/\/docs\//);
  const docUrl = alice.url();
  await alice.getByLabel('Document title').fill(title);
  const editor = alice.getByLabel('Document content');
  await editor.click();
  await alice.getByRole('button', { name: 'Heading 1' }).click();
  await alice.keyboard.type('Launch plan');
  await alice.keyboard.press('Enter');
  await alice.keyboard.press('Control+B');
  await alice.keyboard.type('Ship it');
  await expect(alice.getByText('All changes saved')).toBeVisible();

  // Formatting survives a reload.
  await alice.reload();
  await expect(alice.getByLabel('Document title')).toHaveValue(title);
  await expect(editor.locator('h1')).toHaveText('Launch plan');
  await expect(editor.locator('strong')).toHaveText('Ship it');

  // Share with Bob as a viewer.
  await alice.getByRole('button', { name: 'Share' }).click();
  await alice.getByLabel('Email to share with').fill('bob@example.com');
  await alice.getByLabel('Access level').selectOption('viewer');
  await alice.getByRole('dialog').getByRole('button', { name: 'Share' }).click();
  await expect(alice.getByRole('dialog').getByText('Bob Smith')).toBeVisible();
  await alice.getByRole('button', { name: 'Done' }).click();

  // Bob finds it under "Shared with me" and opens it read-only.
  const bob = await signInAs(browser, 'Bob Smith');
  const sharedSection = bob.locator('section', { hasText: 'Shared with me' });
  await expect(sharedSection.getByRole('link', { name: new RegExp(title) })).toContainText('Alice Johnson · viewer');
  await sharedSection.getByRole('link', { name: new RegExp(title) }).click();
  await expect(bob.getByText('View only')).toBeVisible();
  await expect(bob.getByRole('toolbar', { name: 'Formatting' })).toHaveCount(0);
  await expect(bob.getByLabel('Document content')).toHaveAttribute('contenteditable', 'false');

  // Presence: each sees the other.
  await expect(alice.getByLabel(/Also here: Bob Smith \(viewing\)/)).toBeVisible();
  await expect(bob.getByLabel(/Also here: Alice Johnson \(editing\)/)).toBeVisible();

  // Live update: Alice types, Bob's page updates without a reload.
  await editor.locator('strong').click();
  await alice.keyboard.press('End');
  await alice.keyboard.type(' now');
  await expect(alice.getByText('All changes saved')).toBeVisible();
  await expect(bob.getByLabel('Document content')).toContainText('Ship it now');

  // Upgrade Bob to editor; after reload he gets the toolbar and can edit.
  await alice.getByRole('button', { name: 'Share' }).click();
  await alice.getByLabel('Access level for Bob Smith').selectOption('editor');
  await expect(alice.getByLabel('Access level for Bob Smith')).toHaveValue('editor');
  await alice.getByRole('button', { name: 'Done' }).click();
  await bob.reload();
  await expect(bob.getByRole('toolbar', { name: 'Formatting' })).toBeVisible();

  // Carol was never invited: the URL gives her nothing.
  const carol = await signInAs(browser, 'Carol Lee');
  await carol.goto(docUrl);
  await expect(carol.getByText('Document unavailable')).toBeVisible();

  // Clean up: the owner deletes the document.
  alice.once('dialog', (d) => d.accept());
  await alice.getByRole('button', { name: 'Delete' }).click();
  await alice.waitForURL((u) => u.pathname === '/');
});
