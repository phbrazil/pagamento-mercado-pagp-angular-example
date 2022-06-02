import { Component, Inject, LOCALE_ID, OnInit, Pipe, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators, } from '@angular/forms';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Constants } from 'src/app/components/shared/utils/Constants';
import { User } from 'src/app/_models/user';
import { AccountService } from 'src/app/_services/account.service';
import { AlertService } from 'src/app/_services/alert.service';
declare var MercadoPago: any;
import { formatCurrency, getCurrencySymbol } from '@angular/common';
import { faAngleRight } from '@fortawesome/free-solid-svg-icons';


@Component({
  selector: 'app-new-card',
  templateUrl: './new-card.component.html',
  styleUrls: ['./new-card.component.scss'],
  encapsulation: ViewEncapsulation.None // Here

})

//https://www.mercadopago.com.br/developers/en/docs/checkout-api/payment-methods/receiving-payment-by-card#editor_7


export class NewCardComponent implements OnInit {

  user: User;

  isLoading: boolean = false;

  progress: number = 0;

  amount: number = 0;
  amountPipeString: string;

  activeUsers: number = 0;

  faAngleRight = faAngleRight;


  //emailTest: string = 'test_user_898709461234@testuser.com';

  installments: string = '';
  identificationType: string = '';
  issuer: string = '';
  identificationMask: string = '';

  newCardForm: FormGroup;

  constructor(private accountService: AccountService, private matDialog: MatDialog,
    private router: Router, private fb: FormBuilder, @Inject(MAT_DIALOG_DATA) public data: any,
    private alertService: AlertService,
    @Inject(LOCALE_ID) private locale: string) {

    this.accountService.user.subscribe(x => this.user = x);

    this.router.routeReuseStrategy.shouldReuseRoute = () => false;

  }


  ngOnInit(): void {

    this.newCardForm =
      this.fb.group({
        checkout__cardholderName: ['', Validators.required],
        checkout__cardNumber: ['', Validators.required],
        checkout__expirationDate: ['', Validators.required],
        checkout__securityCode: ['', Validators.required],
        checkout__issuer: ['', Validators.required],
        checkout__identificationType: ['', Validators.required],
        checkout__identificationNumber: ['', Validators.required],
        checkout__installments: ['', Validators.required],
        checkout__cardholderEmail: [this.user.email, Validators.required],
      });


    this.amount = this.data.currentPlanValue;
    this.activeUsers = this.data.activeUsers;

    this.amountPipeString = formatCurrency(this.amount, this.locale, getCurrencySymbol('BRL', 'wide'));

    this.loadForm();

  }

  submit() {

    this.isLoading = true;

  }

  checkSelects() {

    this.installments = (<HTMLSelectElement>document.getElementById('form-checkout__installments')).value;
    this.identificationType = (<HTMLSelectElement>document.getElementById('form-checkout__identificationType')).value;
    this.issuer = (<HTMLSelectElement>document.getElementById('form-checkout__issuer')).value;

    this.newCardForm.patchValue({
      checkout__installments: this.installments,
      checkout__identificationType: this.identificationType,
      checkout__issuer: this.issuer,
    })


  }

  ngOnDestroy() {
    console.log('fechei')

    this.router.navigate(['/manage']);

  }


  loadForm() {

    const mp = new MercadoPago(Constants.public_key);

    const cardForm = mp.cardForm({
      amount: String(this.amount),
      autoMount: true,
      debug: true,
      form: {
        id: "form-checkout",
        cardholderName: {
          id: "form-checkout__cardholderName",
          placeholder: "Titular do cartão",
        },
        cardholderEmail: {
          id: "form-checkout__cardholderEmail",
          placeholder: "E-mail",
        },
        cardNumber: {
          id: "form-checkout__cardNumber",
          placeholder: "Número do cartão",
        },
        expirationDate: {
          id: "form-checkout__expirationDate",
          placeholder: "MM/YYYY",
        },
        securityCode: {
          id: "form-checkout__securityCode",
          placeholder: "000",
        },
        installments: {
          id: "form-checkout__installments",
          placeholder: "Parcelas",
        },
        identificationType: {
          id: "form-checkout__identificationType",
          placeholder: "Tipo de documento",
        },
        identificationNumber: {
          id: "form-checkout__identificationNumber",
          placeholder: "Número do documento",
        },
        issuer: {
          id: "form-checkout__issuer",
          placeholder: "Banco emissor",
        },
      },
      callbacks: {
        onFormMounted: (error: any) => {
          if (error) return console.warn("Form Mounted handling error: ", error);
          console.log("Form mounted");
        },
        onSubmit: (event: { preventDefault: () => void; }) => {

          //progress Bar

          this.progressBar();


          event.preventDefault();

          const {
            paymentMethodId: payment_method_id,
            issuerId: issuer_id,
            cardholderEmail: email,
            amount,
            token,
            installments,
            identificationNumber,
            identificationType,
          } = cardForm.getCardFormData();

          //fetch(Constants.baseUrl + "/opportunity/payment/process_payment", {
          //fetch("/process_payment", {
          fetch(Constants.baseUrl + "/opportunity/payment/subscribe_plan", {
            //fetch("/subscribe_plan", {
            method: "POST",
            mode: 'cors',
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Authorization": "Bearer " + this.accountService.getToken(),
              "Accept": "application/json",
              "Access-Control-Allow-Origin": "https://www.getopportunity.com.br"
            },
            body: JSON.stringify({
              token,
              issuer_id,
              payment_method_id,
              transaction_amount: Number(amount),
              installments: Number(installments),
              description: "Assinatura " + Constants.system_name,
              idUser: this.user.idUser,
              preapproval_plan_id: Constants.preapproval_plan_id,
              payer: {
                email,
                identification: {
                  type: identificationType,
                  number: identificationNumber,
                },
              },
            }),
          }).then(response => response.json())
            .then(data => {

              console.log(data);

              if (data.status == 'authorized') {

                //set new user locally
                this.user.trial = false;
                this.accountService.setUser(this.user);
                localStorage.setItem('user', JSON.stringify(this.user));

                console.log('reloading card')
                this.matDialog.closeAll();
                this.router.navigate(['/manage']);

                this.alertService.success('Pagamento aprovado!', 'Aproveite nossa ferramenta', { autoClose: true, keepAfterRouteChange: true });

              } else if (data.status == 'pending') {
                this.isLoading = false;
                this.alertService.error('Pagamento rejeitado', 'Verifique os dados do cartão e tente novamente', { autoClose: true, keepAfterRouteChange: true });
                this.progress = 0;

              } else {
                this.isLoading = false;
                this.alertService.error('Ocorreu um erro', 'Verifique os dados do cartão e tente novamente', { autoClose: true, keepAfterRouteChange: true });
                this.progress = 0;

              }

            }).catch(error => {

              console.log(error)

              this.isLoading = false;
              this.alertService.error('Ocorreu um erro', 'Verifique os dados do cartão e tente novamente', { autoClose: true, keepAfterRouteChange: true });
              this.progress = 0;

            });
        },
        onFetching: (resource: any) => {
          console.log("Fetching resource: ", resource);

          // Animate progress bar
          const progressBar = document.querySelector(".progress-bar");
          // progressBar.removeAttribute("value");

          this.progress = 100;

          return () => {
            //progressBar.setAttribute("value", "0");

            this.progress = 0;

          };
        }
      },
    });

  }

  progressBar() {

    if (this.progress == 0) {
      this.progress = 1;
      var elem = document.getElementById("progress");
      var width = 1;
      var id = setInterval(frame, 10);
      function frame() {
        if (width >= 100) {
          clearInterval(id);
          //this.progress = 0;
        } else {
          width++;
          elem.style.width = width + "%";
        }
      }
    }
  }

  getIdentificationMask(document: any) {

    console.log(document.target.value.length)

    if (document.target.value.length == 11) {
      this.identificationMask = '000.000.000-00';

      this.newCardForm.patchValue({
        checkout__identificationType: 'CPF',
      })

    } else if(document.target.value.length == 14) {
      this.identificationMask = '00.000.000/0001-00';

      this.newCardForm.patchValue({
        checkout__identificationType: 'CNPJ',
      })

    }else{

      this.identificationMask = '';

    }
  }

}
