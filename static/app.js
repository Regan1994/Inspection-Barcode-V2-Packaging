document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('scan-form');
  const input = document.getElementById('payload');
  if (form && input) {
    input.focus();
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        form.submit();
      }
    });
  }
  const finishResultsDialog = document.getElementById('finish-results-dialog');
  if (finishResultsDialog && typeof finishResultsDialog.showModal === 'function') {
    finishResultsDialog.showModal();
  }
  const orderForm = document.getElementById('inspection-order-form');
  if (orderForm) {
    orderForm.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.matches('input, select')) {
        event.preventDefault();
      }
    });
  }
  const motorBrand = document.getElementById('motor-brand');
  const motorSpec = document.getElementById('motor-spec');
  const motorCatalog = document.getElementById('motor-spec-catalog');
  if (motorBrand && motorSpec && motorCatalog) {
    const entries = JSON.parse(motorCatalog.textContent);
    const addMotorButton = document.getElementById('add-motor-button');
    const cancelAddMotorButton = document.getElementById('cancel-add-motor-button');
    const newMotorFields = document.getElementById('new-motor-fields');
    const newMotorEnabled = document.getElementById('new-motor-enabled');
    const newBrandInput = document.getElementById('new-motor-brand');
    const newSpecInput = document.getElementById('new-motor-spec');
    const refreshModels = () => {
      motorSpec.innerHTML = '';
      const specs = entries.filter((entry) => entry.brand === motorBrand.value);
      motorSpec.disabled = !motorBrand.value;
      motorSpec.required = Boolean(motorBrand.value);
      motorSpec.add(new Option(motorBrand.value ? '請選擇型號' : '請先選擇品牌', ''));
      specs.forEach((entry) => motorSpec.add(new Option(entry.spec, entry.spec)));
      if (motorSpec.dataset.selected) {
        motorSpec.value = motorSpec.dataset.selected;
        delete motorSpec.dataset.selected;
      }
    };
    motorBrand.addEventListener('change', refreshModels);
    const stopAddingMotor = () => {
      newMotorFields.hidden = true;
      newMotorEnabled.value = '0';
      newBrandInput.disabled = true;
      newSpecInput.disabled = true;
      newBrandInput.required = false;
      newSpecInput.required = false;
      newBrandInput.value = '';
      newSpecInput.value = '';
      motorBrand.disabled = false;
      motorBrand.required = true;
      refreshModels();
      addMotorButton.hidden = false;
    };
    addMotorButton.addEventListener('click', () => {
      newMotorFields.hidden = false;
      newMotorEnabled.value = '1';
      newBrandInput.disabled = false;
      newSpecInput.disabled = false;
      newBrandInput.required = true;
      newSpecInput.required = true;
      motorBrand.disabled = true;
      motorSpec.disabled = true;
      motorBrand.required = false;
      motorSpec.required = false;
      addMotorButton.hidden = true;
      newBrandInput.focus();
    });
    cancelAddMotorButton.addEventListener('click', stopAddingMotor);
    refreshModels();
  }
  const axisDialog = document.getElementById('axis-choice-dialog');
  if (axisDialog && motorCatalog && orderForm) {
    const catalog = JSON.parse(motorCatalog.textContent);
    const axisInput = document.getElementById('axis-type');
    const createButton = document.getElementById('create-order-button');
    const forms = { '4': document.getElementById('axis-form-4'), '5': document.getElementById('axis-form-5') };
    document.querySelectorAll('[data-motor-selector]').forEach((selector) => {
      const brand = selector.querySelector('.motor-brand'); const spec = selector.querySelector('.motor-spec');
      brand.addEventListener('change', () => { spec.innerHTML = ''; spec.add(new Option('請選擇型號', '')); catalog.filter((item) => item.brand === brand.value).forEach((item) => spec.add(new Option(item.spec, item.spec))); spec.disabled = !brand.value; });
    });
    let axisConfirmed = false;
    const chooseAxis = (axis) => {
      axisInput.value = axis; axisConfirmed = true;
      Object.entries(forms).forEach(([key, form]) => { const active = key === axis; form.hidden = !active; form.querySelectorAll('select').forEach((select) => { select.disabled = !active; select.required = active; }); });
      if (axisDialog.open) axisDialog.close();
    };
    axisDialog.querySelectorAll('[data-axis-choice]').forEach((button) => button.addEventListener('click', () => chooseAxis(button.dataset.axisChoice)));
    document.getElementById('axis-choice-cancel').addEventListener('click', () => axisDialog.close());
    orderForm.addEventListener('submit', (event) => {
      if (!axisConfirmed) { event.preventDefault(); axisDialog.showModal(); }
    });
  }
  if (motorCatalog) {
    const catalog = JSON.parse(motorCatalog.textContent);
    document.querySelectorAll('[data-motor-selector]').forEach((selector) => {
      const brand = selector.querySelector('.motor-brand');
      const spec = selector.querySelector('.motor-spec');
      const addButton = selector.querySelector('.add-motor-button');
      const cancelButton = selector.querySelector('.new-motor-cancel');
      const newFields = selector.querySelector('.new-motor-fields');
      const enabled = selector.querySelector('.new-motor-enabled');
      const newBrand = selector.querySelector('.new-motor-brand');
      const newSpec = selector.querySelector('.new-motor-spec');
      brand.addEventListener('change', () => {
        spec.innerHTML = '';
        spec.add(new Option(brand.value ? '請選擇型號' : '不選擇', ''));
        catalog.filter((item) => item.brand === brand.value).forEach((item) => spec.add(new Option(item.spec, item.spec)));
        spec.disabled = !brand.value;
        if (spec.dataset.selected) {
          spec.value = spec.dataset.selected;
          delete spec.dataset.selected;
        }
      });
      addButton.addEventListener('click', () => { newFields.hidden = false; enabled.value = '1'; brand.disabled = true; spec.disabled = true; newBrand.disabled = false; newSpec.disabled = false; addButton.hidden = true; newBrand.focus(); });
      cancelButton.addEventListener('click', () => { newFields.hidden = true; enabled.value = '0'; brand.disabled = false; newBrand.disabled = true; newSpec.disabled = true; newBrand.value = ''; newSpec.value = ''; addButton.hidden = false; brand.dispatchEvent(new Event('change')); });
      brand.dispatchEvent(new Event('change'));
    });
  }
  const selectedAxis = orderForm && orderForm.querySelector('input[name="axis_type"]');
  const orderModel = orderForm && orderForm.querySelector('input[name="model_name"]');
  if (selectedAxis && orderModel) {
    orderForm.addEventListener('submit', (event) => {
      const isFiveAxisModel = /^(F|M)/i.test(orderModel.value.trim());
      if ((selectedAxis.value === '5') !== isFiveAxisModel) {
        event.preventDefault();
        window.alert('選擇的軸別與機型不一致：F／M 開頭請選五軸，其餘機型請選四軸。');
      }
    });
  }
  const mode = document.getElementById('create_mode');
  const range = document.getElementById('range-fields');
  const single = document.getElementById('single-field');
  if (mode && range && single) {
    const update = () => { const isRange = mode.value === 'range'; range.hidden = !isRange; single.hidden = isRange; };
    mode.addEventListener('change', update); update();
  }
});

